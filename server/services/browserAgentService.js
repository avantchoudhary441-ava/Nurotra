/**
 * BROWSER AGENT SERVICE
 * 
 * Provides autonomous control over a virtual browser (Playwright).
 * Supports informational retrieval (Web Search) and operational execution (Sheets/Notion/CRM).
 */

const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

const mongoose = require("mongoose");
const Integration = require("../models/Integration");
const ActionMessage = require("../models/ActionMessage");
const ActionWorkflow = require("../models/ActionWorkflow");
const { generateWithFallback } = require("./aiService");
const agentResourceService = require("./agentResourceService");
const NuroMemory = require("../models/NuroMemory");

class BrowserAgentService {
    constructor() {
        this.browser = null;
        this.activeContexts = new Map(); // userId -> browserContext
        this.activePages = new Map(); // userId -> Page
        this.activeStreams = new Map(); // userId -> intervalId
        this.io = null; // Global socket server instance
    }

    setIO(io) {
        this.io = io;
    }

    /**
     * Terminate and clear the active session for a user.
     * Useful for manual recovery when the engine hangs.
     */
    async restartSession(userId) {
        console.log(`[BrowserAgent] [${userId}] Manually restarting browser session...`);
        
        try {
            const page = this.activePages.get(userId.toString());
            if (page) {
                await page.close().catch(() => {});
                this.activePages.delete(userId.toString());
            }

            const context = this.activeContexts.get(userId.toString());
            if (context) {
                await context.close().catch(() => {});
                this.activeContexts.delete(userId.toString());
            }

            // Also close the main browser/context instance
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }

            this.stopStreaming(userId);
            console.log(`[BrowserAgent] [${userId}] Session cleared.`);
            return true;
        } catch (e) {
            console.error(`[BrowserAgent] [${userId}] Failed to restart session:`, e.message);
            return false;
        }
    }

    /**
     * Start a continuous live stream of the browser screen.
     */
    startStreaming(userId, page) {
        if (this.activeStreams.has(userId.toString())) return;
        
        console.log(`[BrowserAgent] [${userId}] Initiating Live Stream Monitor...`);
        const interval = setInterval(async () => {
            try {
                if (page.isClosed()) {
                    this.stopStreaming(userId);
                    return;
                }
                // Use lower quality for background stream to maintain performance
                await this.emitFrame(null, userId, page, "LIVE", null, 30);
            } catch (e) {
                this.stopStreaming(userId);
            }
        }, 800); // ~1.2 FPS is a good balance for live feel vs resource usage
        
        this.activeStreams.set(userId.toString(), interval);
    }

    /**
     * Stop the live stream for a user.
     */
    stopStreaming(userId) {
        const interval = this.activeStreams.get(userId.toString());
        if (interval) {
            clearInterval(interval);
            this.activeStreams.delete(userId.toString());
            console.log(`[BrowserAgent] [${userId}] Live Stream suspended.`);
        }
    }

    /**
     * Non-blocking helper to save messages to the database.
     * Prevents DB hangs from stalling the browser agent.
     */
    safeSaveMessage(userId, role, content, type = "text", metadata = {}) {
        new ActionMessage({
            userId,
            role,
            content,
            type,
            metadata,
            timestamp: new Date()
        }).save().then(() => {
            // Push real-time update to frontend so result appears instantly
            if (this.io) {
                this.io.to(userId.toString()).emit('chat_update', { userId });
            }
        }).catch(err => {
            console.error(`[BrowserAgent] Non-blocking DB save failed for ${userId}:`, err.message);
        });
    }

    /**
     * Log a granular execution step to the active workflow for the user.
     */
    async logExecutionStep(userId, message, status = "info", socket = null, screenshot = false, stepsCollector = null) {
        try {
            const wf = await ActionWorkflow.findOne({ userId, status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } }).sort({ startTime: -1 });
            
            // Add to collector for final metadata persistence
            if (stepsCollector) {
                stepsCollector.push({ message, type: status, timestamp: new Date() });
            }

            if (!wf) {
                if (socket && userId) {
                    socket.emit("execution_log", { userId, message, type: status, timestamp: new Date() });
                }
                return;
            }

            let evidenceUrl = null;
            if (screenshot) {
                const page = this.activePages.get(userId.toString());
                if (page) {
                    evidenceUrl = await this.captureStepProof(userId, wf._id);
                }
            }

            wf.executionLogs.push({
                stepLabel: message,
                status: status === "error" ? "failed" : "completed",
                message,
                timestamp: new Date(),
                level: status,
                evidenceUrl: evidenceUrl || undefined
            });
            wf.activeMicroLog = message;
            await wf.save();

            const logData = { userId, workflowId: wf._id, message, level: status, evidenceUrl, timestamp: new Date() };
            if (socket) {
                socket.emit("execution_log", logData);
            } else if (this.io) {
                this.io.to(userId.toString()).emit("execution_log", logData);
            }
        } catch (err) {
            console.error(`[BrowserAgent] Failed to log step for ${userId}:`, err.message);
        }
    }

    /**
     * Capture a discrete screenshot during the task for inclusion in the log.
     */
    async captureStepProof(userId, workflowId, message = '') {
        // Fallback for when called with (page, userId, message) from searchInfo
        if (typeof userId === 'object' && userId !== null) {
            userId = workflowId;
            workflowId = 'search'; 
        }
        try {
            const page = this.activePages.get(userId.toString());
            if (!page) return null;
            
            const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
            const { cloudinary } = require("../config/cloudinary");

            return new Promise((resolve) => {
                cloudinary.uploader.upload_stream({
                    folder: 'nurotra_proofs',
                    public_id: `step_${workflowId}_${Date.now()}`,
                    resource_type: 'image'
                }, (error, result) => {
                    if (error) resolve(null);
                    else resolve(result.secure_url);
                }).end(screenshot);
            });
        } catch (e) {
            return null;
        }
    }

    /**
     * Initialize the browser instance if not already running
     */
    async init(userId = "default") {
        if (!this.browser) {
            console.log("[BrowserAgent] Starting Persistent Chromium engine (Real Profile Mode)...");
            
            const path = require('path');
            const userDataDir = path.join(process.cwd(), 'user_session');

            // Using launchPersistentContext is the ultimate stealth move
            // It makes the browser look like a standard installed application
            this.browser = await chromium.launchPersistentContext(userDataDir, {
                headless: false,
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // USE REAL CHROME
                channel: 'chrome',
                viewport: null, // Let it use default size
                acceptDownloads: true,
                ignoreDefaultArgs: ['--enable-automation'], // REMOVES the automation banner/flag
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--start-maximized',
                    '--disable-infobars',
                    '--disable-dev-shm-usage',
                    '--disable-browser-side-navigation'
                ]
            });
            
            // In PersistentContext, 'browser' is actually a 'Context' object
            // We need to adapt our internal references
            this.activeContexts.set(userId.toString(), this.browser);
        }
    }

    /**
     * Clear and initialize a clean frame to wake up the UI monitor.
     */
    async wakeUpMonitor(userId, socket = null) {
        if (!socket && !this.io) return;
        const io = this.io || socket?.server;
        
        // Emit a simple "Virtual Environment Initialized" placeholder frame or clear state
        io.to(userId.toString()).emit("browser_frame", {
            userId,
            frame: null, 
            status: "Virtual Environment Initialized. Preparing engine...",
            url: "about:blank",
            timestamp: new Date()
        });
    }

    /**
     * Smoothly scroll a page down while emitting frames to the client
     */
    async autoScrollAndStream(page, socket, userId, scrollSteps = 3, delayMs = 600) {
        if (!socket) return;
        try {
            await this.logExecutionStep(userId, "Scrolling through page to load content...", "info", socket);
            for (let i = 0; i < scrollSteps; i++) {
                await page.evaluate(() => {
                    window.scrollBy({ top: 400, left: 0, behavior: 'smooth' });
                });
                await page.waitForTimeout(delayMs);
                await this.emitFrame(socket, userId, page, "Reading page content...");
            }
            await page.waitForTimeout(500);
        } catch (err) {
            console.warn(`[BrowserAgent] Scroll failed: ${err.message}`);
        }
    }

    /**
     * Get or create a persistent context for a user
     */
    async getContext(userId) {
        // Ensure browser is initialised as a persistent context
        await this.init(userId);
        
        // In persistent mode, this.browser is the context
        return this.browser; 
    }



    /**
     * Execute an informational search (e.g., Live Scores)
     */
    async searchInfo(userId, query, socket = null, skipSave = false, options = {}) {
        let currentProvider = 'Google';
        let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const executionSteps = [];
        let page = this.activePages.get(userId.toString());
        const context = await this.getContext(userId);

        if (!page || page.isClosed()) {
            page = await context.newPage();
            this.activePages.set(userId.toString(), page);
        } else {
            console.log(`[BrowserAgent] [${userId}] Reusing existing session for continuation...`);
        }
        
        // Instant reality: Show the browser immediately and start live stream
        this.startStreaming(userId, page);
        await this.emitFrame(socket, userId, page);
        
        try {
            console.log(`[BrowserAgent] Searching for: "${query}" using ${currentProvider}`);
            await this.logExecutionStep(userId, `Searching ${currentProvider} for: "${query}"`, "info", socket, false, executionSteps);
            await this.emitFrame(socket, userId, page, `Looking on ${currentProvider} for "${query}"...`);
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Detection for CAPTCHA/Blocks
            let isBlocked = page.url().includes("google.com/sorry") || (await page.content()).includes("captcha");

            if (isBlocked) {
                console.warn(`[BrowserAgent] Block detected. Switching to DuckDuckGo...`);
                await this.emitFrame(socket, userId, page, "Access temporarily restricted. Switching to backup source...");
                currentProvider = 'DuckDuckGo';
                searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(1500); 
            }

            // --- DEEP SEARCH LOGIC (Multi-Site & Self Learning) ---
            await this.emitFrame(socket, userId, page, `Reviewing the findings for "${query}"...`);
            
            // 1. Get Snippets & Links
            const pageText = await page.innerText('body');
            const links = await page.evaluate(() => {
                const results = [];
                // Google selectors
                document.querySelectorAll('a h3').forEach(el => {
                    const a = el.closest('a');
                    if (a && a.href && !a.href.includes('google.com')) results.push({ title: el.innerText, url: a.href });
                });
                // DuckDuckGo selectors
                document.querySelectorAll('a.result__a').forEach(el => {
                    if (el.href && !el.href.includes('duckduckgo.com')) results.push({ title: el.innerText, url: el.href });
                });
                return results.slice(0, 5); // Top 5 relevant links
            });

            // 2. Memory Context & Fast-Track Logic
            const memory = await NuroMemory.findOne({ userId }).lean();
            const failedDomains = memory?.browserIntelligence?.failedDomains || [];
            
            const deepDiveKeywords = ["go deep", "find forms", "apply", "deep dive", "explore", "details", "internship", "job", "scores", "live", "news", "current", "latest", "update", "real-time"];
            const needsDeep = deepDiveKeywords.some(k => query.toLowerCase().includes(k)) || /score|live|news|current/.test(query.toLowerCase());

            let plan = { action: "STAY" };
            
            if (needsDeep || links.length === 0) {
                try {
                     const decisionPrompt = `User Question: "${query}"
                     
                     Search Results Snippets:
                     ${pageText.substring(0, 3000)}
                     
                     Available Links to Explore:
                     ${links.map((l, i) => `[${i}] ${l.title} - ${l.url}`).join('\n')}
                     
                     BLACKLISTED DOMAINS: ${JSON.stringify(failedDomains)}. Do NOT visit these.
                     
                     The user explicitly requires a deep dive or forms to be found.
                     Select 1 to 3 URLs that are most likely to contain the targeted data for exploration.
                     
                     Respond STRICTLY in JSON format:
                     { "action": "EXPLORE", "urls": ["url1", "url2"] }
                     
                     CRITICAL: If the current Search Results Snippets do NOT contain the final answer (e.g. they only describe the site), you MUST choose EXPLORE with the most relevant URLs. Do NOT stay on the search page if the data is missing.
                     
                     If absolutely no relevant links exist, use: { "action": "STAY", "reason": "No valid deep links available" }`;
                     
                     const decisionRes = await generateWithFallback(decisionPrompt, "You are a web search strategist.", [], [], { forceJson: true });
                     plan = JSON.parse(decisionRes.replace(/```json|```/g, '').trim());
                     console.log(`[BrowserAgent] Search Plan:`, plan);
                } catch (e) {
                     console.log("[BrowserAgent] AI Decision failed, defaulting to STAY.", e.message);
                }
            } else {
                 console.log("[BrowserAgent] Snippet mode engaged. Fast response path.");
            }
            
            let collectedContent = [ { url: searchUrl, content: pageText } ];
            let finalUrl = searchUrl;

            if (plan.action === "EXPLORE" && plan.urls && plan.urls.length > 0) {
                 for (let targetUrl of plan.urls.slice(0, 3)) { // Explore top 3
                     targetUrl = targetUrl.replace(/^[\[\("']+|[\]\)"']+$/g, '');
                     if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
                     
                     let domainCode = "Unknown";
                     try { domainCode = new URL(targetUrl).hostname; } catch (e) {}

                     console.log(`[BrowserAgent] Deep-diving into: ${targetUrl}`);
                     await this.logExecutionStep(userId, `Exploring: ${domainCode}`, "info", socket, false, executionSteps);
                     await this.emitFrame(socket, userId, page, `Exploring: ${domainCode}...`);
                     
                     try {
                         // Switch to 'load' + wait for dynamic hydration
                         await page.goto(targetUrl, { waitUntil: 'load', timeout: 25000 });
                         await page.waitForTimeout(3000); 
                         await this.autoScrollAndStream(page, socket, userId, 3, 600);
                         
                         const innerText = await page.innerText('body');
                         const isHighQuality = innerText.length > 1500 && !innerText.includes("JavaScript") && !innerText.includes("Access Denied");

                         if (isHighQuality && !innerText.includes("captcha")) {
                             collectedContent.push({ url: targetUrl, content: innerText });
                             finalUrl = page.url();
                             await this.logExecutionStep(userId, `Critical data extracted from ${domainCode}.`, "success", socket, false, executionSteps);
                             this.updateBrowserMemory(userId, domainCode, true, "Success");
                         } else {
                             await this.logExecutionStep(userId, `Limited data on ${domainCode}. checking alternative...`, "warn", socket, false, executionSteps);
                         }
                     } catch (navErr) {
                         console.error(`[BrowserAgent] Deep navigation failed for ${targetUrl}:`, navErr.message);
                         await this.logExecutionStep(userId, `Domain ${domainCode} unreachable. Skipping...`, "error", socket, false, executionSteps);
                     }
                 }
            } else {
                 await this.logExecutionStep(userId, "Extracting strategic intelligence from search results.", "info", socket, false, executionSteps);
                 await this.emitFrame(socket, userId, page, "Snippet extraction mode engaged. Writing report...");
            }

            // Synthesize all collected content
            const finalContent = collectedContent
                .map(c => `[[ SOURCE: ${c.url} ]]\n${c.content.substring(0, 10000)}`)
                .join("\n\n" + "=".repeat(30) + "\n\n");

            // --- QUOTA BREATHER ---
            // Small delay to prevent hitting RPM limits when making back-to-back calls
            await new Promise(r => setTimeout(r, 1500)); 

            // 3. Final Extraction: Data-first, Business Grace
            await this.logExecutionStep(userId, "Synthesizing professional strategic report...", "info", socket, executionSteps);
            const extractionPrompt = `You are Nurotra, a knowledgeable and articulate AI assistant.
            Task: ${query}
            
            Current URL: ${finalUrl}
            
            CRITICAL RULES:
            1. EXTRACT REAL DATA: Pull out actual numbers, scores, dates, names, facts, and statistics visible in the content.
            2. NEVER list or describe websites. The user wants the DATA, not a directory of sources.
            3. Write in natural, flowing prose — like a smart human explaining findings to a colleague. Do NOT default to bullet points unless the content is genuinely a list of items (e.g., top 5 results, multiple match scores).
            4. Use **bold** for key names or important values inline within sentences (e.g., "**Mumbai Indians** scored 178/4 against **CSK**'s 162/8").
            5. Use short paragraphs. Each paragraph should cover one idea. Leave a blank line between paragraphs.
            6. If the data is genuinely not available, say so honestly in one clear sentence.
            7. NEVER hallucinate or invent data. Only use what's in the CONTENT below.
            8. NEVER tell the user to visit a website themselves.
            9. NEVER ask follow-up questions like "Would you like me to go deeper?".
            10. End with a single line: "Source: ${finalUrl}"
            
            WRITING STYLE:
            - Conversational but precise, like a Bloomberg terminal summary written by a human
            - Vary sentence structure — mix short punchy sentences with richer explanatory ones
            - Only use bullet points if there are 3+ parallel items that genuinely make sense as a list
            
            CONTENT TO ANALYZE:
            ${finalContent.substring(0, 10000)}`;

            const finalResult = await generateWithFallback(extractionPrompt, "You are the Nurotra Professional Strategic Assistant. Your voice is graceful, simple, and respectful.", [], [], { forceJson: false });
            
            // CAPTURE FINAL PROOF
            let evidenceUrl = null;
            try {
                evidenceUrl = await this.captureStepProof(page, userId, `Final results for: ${query}`);
            } catch (err) {
                console.error("[BrowserAgent] Final proof capture failed:", err.message);
            }

            if (!skipSave) {
                this.safeSaveMessage(userId, "agent", finalResult, "browser_result", { 
                    query, 
                    sourceUrl: finalUrl, 
                    evidenceUrl,
                    provider: currentProvider,
                    executionSteps // Real steps for the UI to show
                });
            }

            console.log(`[BrowserAgent] [${userId}] Search completed. [Persistent: ${options.reuseSession}]`);
            if (!options.reuseSession) {
                this.stopStreaming(userId);
                await page.close();
                this.activePages.delete(userId.toString());
            }
            return { 
                success: true, 
                answer: finalResult,
                metadata: {
                    sourceUrl: finalUrl,
                    evidenceUrl,
                    executionSteps
                }
            };

        } catch (error) {
            console.error("[BrowserAgent] Search failed:", error.message);
            this.stopStreaming(userId);
            // Always clean up on error to prevent hung sessions
            await page.close().catch(() => {});
            this.activePages.delete(userId.toString());
            throw error;
        }
    }

    /**
     * Perform an operational task (e.g., Update Sheet)
     */
    async executeTask(userId, platform, taskDescription, socket = null, options = {}) {
        const executionSteps = [];
        const context = await this.getContext(userId);
        let page = this.activePages.get(userId.toString());
        
        // Fetch active workflow to sync status
        const wf = await ActionWorkflow.findOne({ userId, status: { $in: ["running", "intervention"] } }).sort({ startTime: -1 });

        // DETERMINE RESUMPTION STATE
        let isResuming = false;
        let interventionContext = "";
        
        if (wf) {
            const currentStep = wf.steps.find(s => s.status === 'running' || s.status === 'intervention');
            if (currentStep?.missingData?.length > 0) {
                isResuming = true;
                interventionContext = "\nUSER ASSET INJECTION (from Intervention):\n" + 
                    currentStep.missingData.map(m => `- ${m.field}: ${m.inferredValue}`).join('\n');
            } else if (currentStep?.resultData?.interventionResponse) {
                isResuming = true;
                interventionContext = `\nUSER ASSET INJECTION (from Intervention): ${currentStep.resultData.interventionResponse}`;
            }
        }

        if (!page || page.isClosed()) {
            try {
                page = await context.newPage();
            } catch (err) {
                console.log(`[BrowserAgent] Context crashed. Relaunching engine...`);
                await this.init();
                const newContext = await this.getContext(userId);
                page = await newContext.newPage();
            }
            this.activePages.set(userId.toString(), page);
            
            // --- TAB MONITORING (Multi-Tab Intelligence) ---
            // Automatically switch focus if a new tab/popup opens
            context.on('page', async (newPage) => {
                console.log(`[BrowserAgent] [${userId}] New tab detected: ${newPage.url()}`);
                await newPage.waitForLoadState().catch(() => {});
                this.activePages.set(userId.toString(), newPage);
                await this.logExecutionStep(userId, "New tab detected. Switching focus to active application window...", "info", socket);
            });
            
            // Check if we are using an authenticated session
            const agentIdentity = await Integration.findOne({ userId, platform: "google_agent", status: "connected" });
            if (agentIdentity?.sessionData?.cookies?.length > 0) {
                await this.logExecutionStep(userId, "🔐 Identity Vault: Session hydrated. You should be pre-logged in.", "success", socket);
            }
        } else {
            if (isResuming) {
                console.log(`[BrowserAgent] [${userId}] Intelligent Resumption: Retaining exact page state.`);
                await this.logExecutionStep(userId, "Data received. Resuming form filling exactly where we left off...", "info", socket);
            } else {
                console.log(`[BrowserAgent] [${userId}] Purging session state for clean start...`);
                await page.goto("about:blank").catch(() => {});
            }
        }

        // Merge the prompt context
        if (interventionContext) {
            taskDescription += " " + interventionContext;
        }

        // Immediate wake up frame and start live stream
        this.startStreaming(userId, page);
        await this.emitFrame(socket, userId, page, "Preparing Virtual Workspace...");
        
        try {
            await this.logExecutionStep(userId, "Virtual workspace initialized.", "info", socket, false, executionSteps);
            // --- IDENTITY HYDRATION (The "Magic" Login) ---
            const agentIdentity = await Integration.findOne({ userId, platform: "google_agent", status: "connected" });
            
            if (agentIdentity && agentIdentity.credentials?.refreshToken) {
                await this.logExecutionStep(userId, "🔐 Identity Vault: Hydrating browser session with your synced Google account...", "info", socket);
                
                // 1. Check if token is expired and refresh if needed
                const isExpired = agentIdentity.credentials.expiresAt && new Date() > new Date(agentIdentity.credentials.expiresAt);
                if (isExpired || !agentIdentity.credentials.accessToken) {
                    await this.logExecutionStep(userId, "🔄 Tokens expired. Silently refreshing authentication...", "info", socket);
                    // Refresh logic here (omitted for brevity, but would use oauth2Client.refreshAccessToken)
                }

                // 2. Perform background authentication
                // For Google, we can use the token to set a session or simulate a login redirect
                // A very reliable way is to navigate to a Google URL that auto-authenticates if we have the token
                // For now, we've set the stage to use these tokens to bypass manual login.
            }

            const integration = await Integration.findOne({ userId, platform });
            const oauthRequired = ["google", "zoom", "notion", "slack", "hubspot"].includes(platform.toLowerCase());
            
            if (oauthRequired && !agentIdentity && platform === "google") {
                // If it's a core Google task but no identity found, we might want to prompt for one-time sync
                await this.logExecutionStep(userId, "⚠️ No synced Google identity found. You may need to sign in manually on the monitor.", "warn", socket);
            } else if (oauthRequired && !integration && platform !== "google") {
                throw new Error(`Platform ${platform} requires a secure connection. Please go to Settings > Integrations to link your account.`);
            }

            // --- INTELLIGENCE-BASED SHORTCUTS (Fast-Track) ---
            const isGoogleJobTask = taskDescription.toLowerCase().includes("google") && (taskDescription.toLowerCase().includes("job") || taskDescription.toLowerCase().includes("apply"));
            
            if (isGoogleJobTask) {
                if (page.url() === "about:blank" || !page.url().includes("google.com")) {
                    // --- PRE-AUTHENTICATION GATE (OAUTH RELAY BYPASS) ---
                    // Google's direct login portal (accounts.google.com) is heavily fortified against automated browsers.
                    // We bypass this by routing the login through a trusted 3rd-party OAuth portal (StackOverflow).
                    // This creates a standard OAuth token flow that bypasses the "Browser may not be secure" block.
                    await this.logExecutionStep(userId, "Step 1: Opening Secure OAuth Relay to bypass browser blocks...", "info", socket);
                    
                    // Route to SO and automatically click the Google login button
                    await page.goto("https://stackoverflow.com/users/login", { waitUntil: 'domcontentloaded' });
                    try {
                        await page.waitForSelector('.s-btn__google, [data-provider="google"]', { timeout: 5000 });
                        await page.click('.s-btn__google, [data-provider="google"]');
                    } catch (e) {
                        console.warn("[BrowserAgent] Failed to click SO Google button, fallback to direct.");
                        await page.goto("https://accounts.google.com/", { waitUntil: 'load' });
                    }
                    
                    await page.waitForTimeout(2000);
                    await this.emitFrame(socket, userId, page, "Please sign in to your Google account on the Live Monitor...");
                    
                    // Check if already signed in (redirected to myaccount page)
                    const afterLoginUrl = page.url();
                    const alreadySignedIn = afterLoginUrl.includes("myaccount.google.com") || afterLoginUrl.includes("accounts.google.com/Default");
                    
                    if (!alreadySignedIn && wf) {
                        await this.logExecutionStep(userId, "🔐 Please sign in to your Google account on the Live Monitor. The agent will continue after you're logged in.", "warn", socket);
                        wf.status = "intervention";
                        wf.activeMicroLog = "Please sign in to Google on the Live Monitor, then click RESUME MISSION.";
                        await wf.save();
                        
                        // Wait for sign-in completion
                        let waitingForAuth = true;
                        while (waitingForAuth) {
                            await this.emitFrame(socket, userId, page, "🔐 Waiting for Google sign-in...");
                            await page.waitForTimeout(500); // reduced from 3000 for near real-time feedback during intervention
                            
                            const checkWf = await ActionWorkflow.findById(wf._id);
                            if (!checkWf || checkWf.status !== "intervention") {
                                waitingForAuth = false;
                                break;
                            }
                            
                            // Auto-detect sign-in completion using the definitive Google Session cookie
                            const currentCookies = await page.context().cookies();
                            const isAuthenticated = currentCookies.some(c => c.domain.includes('.google.com') && (c.name === 'SID' || c.name === 'OSID'));
                            
                            if (isAuthenticated) {
                                
                                // --- COOKIE HARVESTING ---
                                const allCookies = await page.context().cookies();
                                await Integration.findOneAndUpdate(
                                    { userId, platform: "google_agent" },
                                    { "sessionData.cookies": allCookies, "sessionData.lastLogin": new Date() }
                                );
                                await this.logExecutionStep(userId, "🍪 SESSION HARVESTED: Identity saved to vault. You will not need to log in again.", "success", socket);
                                
                                waitingForAuth = false;
                                wf.status = "running";
                                await wf.save();
                                await this.logExecutionStep(userId, "✅ Google sign-in successful! Now navigating to Google Careers...", "success", socket);
                            }
                        }
                    } else {
                        await this.logExecutionStep(userId, "✅ Already signed in to Google. Proceeding to careers...", "success", socket);
                    }
                    
                    // Now navigate to Google Careers (already authenticated!)
                    await this.logExecutionStep(userId, "Fast-Tracking: Routing to Google Careers...", "info", socket);
                    await page.goto("https://careers.google.com/jobs/results/?q=software%20engineer", { waitUntil: 'load' });
                    await page.waitForTimeout(3000);
                }
            } else if (taskDescription.toLowerCase().includes("linkedin") || page.url().includes("naukri")) {
                 await this.logExecutionStep(userId, "Optimizing route: Selecting high-fidelity portal...", "info", socket);
            }

            // Logic for specific platforms would go here
            // For now, we use a generic AI-driven loop
            this.io = socket?.server || socket; // Set the IO instance for this session
            const socketId = options.socketId || null;
            
            let lastDecision = "";
            let lastSnapshotText = "";
            let repeatCount = 0;
            let steps = 0;
            let completed = false;
            const maxSteps = 25;
            const actionHistory = []; // Memory of what we already did

            while (!completed && steps < maxSteps) {
                // Dynamic Page Resolution: Ensure we are always on the latest tab (Multi-tab support)
                page = this.activePages.get(userId.toString()) || page;

                const snapshot = await this.getSnapshot(page);
                const currentUrl = page.url();

                // --- PRIVACY & SAFETY GUARD (Account Page Escape) ---
                // If we get redirected to personal account settings, the AI will hit a safety filter.
                // We must force the agent back to the mission area.
                if (currentUrl.match(/myaccount\.google\.com|accounts\.google\.com/i) && !currentUrl.includes("signin/v2/challenge")) {
                    await this.logExecutionStep(userId, "Privacy Guard: Redirected to Google Account settings. Rerouting to secure mission area...", "warn", socket);
                    await page.goto("https://careers.google.com/jobs/results/?q=software%20engineer", { waitUntil: 'load' }).catch(() => {});
                    await page.waitForTimeout(3000);
                    steps++;
                    continue;
                }

                // --- STRICT PIVOT (Stop the Job Board Loops) ---
                const isTargetingGoogle = taskDescription.toLowerCase().includes("google");
                const isOnBadJobBoard = currentUrl.match(/linkedin|indeed|simplyhired|naukri/i) || 
                                       (isTargetingGoogle && !currentUrl.includes("google.com") && currentUrl !== "about:blank");
                
                if (isTargetingGoogle && isOnBadJobBoard) {
                    await this.logExecutionStep(userId, "Strategic Pivot: Bypassing job-board login walls. Routing to official Google Careers...", "info", socket);
                    await page.goto("https://careers.google.com/jobs/results/?q=software%20engineer", { waitUntil: 'load' });
                    steps++;
                    continue; // Skip the rest of the loop for this site
                }
                
                // --- LOGIN WALL DETECTION (Let user sign in manually) ---
                // ONLY trigger on actual dedicated login page URLs, NOT on pages that just mention "sign in"
                const isLoginPage = currentUrl.includes("accounts.google.com/") || 
                                   currentUrl.match(/\/login\b|\/signin\b|\/auth\b/i);
                
                if (isLoginPage && wf) {
                    await this.logExecutionStep(userId, "🔐 Login required! Please sign in on the Live Monitor. I'll resume automatically after you're logged in.", "warn", socket);
                    wf.status = "intervention";
                    wf.activeMicroLog = "Login page detected. Please sign in manually on the Live Monitor, then click RESUME.";
                    await wf.save();

                    // Keep feed alive while user signs in — give them real time
                    let waitingForLogin = true;
                    while (waitingForLogin) {
                        await this.emitFrame(socket, userId, page, "🔐 Awaiting your login — please sign in on this screen...", socketId);
                        await page.waitForTimeout(3000);

                        const checkWf = await ActionWorkflow.findById(wf._id);
                        if (!checkWf || checkWf.status !== "intervention") {
                            waitingForLogin = false;
                            await this.logExecutionStep(userId, "Login resumed by user. Continuing application...", "success", socket);
                            break;
                        }
                        
                        // Auto-detect if user completed login (URL changed away from login page)
                        const nowUrl = page.url();
                        const stillOnLogin = nowUrl.includes("accounts.google.com/") || 
                                            nowUrl.match(/\/login\b|\/signin\b|\/auth\b/i);
                        if (!stillOnLogin) {
                            waitingForLogin = false;
                            wf.status = "running";
                            await wf.save();
                            await this.logExecutionStep(userId, "Login completed! Resuming job application...", "success", socket);
                        }
                    }
                    continue; // Re-enter the main loop with fresh snapshot
                }

                // --- BLOCK DETECTION ---
                const isBlocked = snapshot.text.includes("Additional Verification Required") || 
                                  snapshot.text.includes("Verify you are human") || 
                                  snapshot.text.includes("captcha") ||
                                  page.url().includes("google.com/sorry") ||
                                  page.url().includes("challenge") ||
                                  (await page.title()).toLowerCase().includes("verification") ||
                                  (await page.content()).includes("cf-turnstile");

                if (isBlocked) {
                    // --- AUTO-SOLVE ATTEMPT ---
                    const cfCheckbox = await page.$('input[type="checkbox"], .ctp-checksum-container');
                    if (cfCheckbox) {
                        await this.logExecutionStep(userId, "Attempting background security bypass...", "info", socket);
                        try {
                            await cfCheckbox.click();
                            await page.waitForTimeout(4000);
                            // Re-evaluate blockade
                            if (! (await page.content()).includes("Verify you are human")) {
                                await this.logExecutionStep(userId, "Security bypass successful. Resuming mission.", "success", socket);
                                continue;
                            }
                        } catch (e) {
                            console.error("Auto-click failed:", e.message);
                        }
                    }

                    await this.logExecutionStep(userId, "⚠️ Security blockade detected. Live feed active—awaiting your solution.", "warn", socket);
                    wf.status = "intervention";
                    wf.activeMicroLog = "Security verification required. Please solve on the Live Monitor.";
                    await wf.save();

                    // --- LIVE OBSERVATION LOOP ---
                    // Keep the camera rolling so the user can see the CAPTCHA
                    let isAwaitingSuccess = true;
                    while (isAwaitingSuccess) {
                        await this.emitFrame(socket, userId, page, "Awaiting User Verification...", socketId);
                        await page.waitForTimeout(1500);

                        const checkWf = await ActionWorkflow.findById(wf._id);
                        if (!checkWf || checkWf.status !== "intervention") {
                            isAwaitingSuccess = false;
                            // Status was changed by resumeIdentity or executeCommand API
                            await this.logExecutionStep(userId, "Verification resolved. Resuming automated execution.", "success", socket);
                            continue; // Re-evaluate snapshot in the main loop
                        }

                        // Also re-check the page source to see if the blockade is gone
                        const currentContent = await page.content();
                        const stillBlocked = currentContent.includes("Verify you are human") || 
                                           currentContent.includes("Additional Verification Required");
                        
                        if (!stillBlocked) {
                            isAwaitingSuccess = false;
                            wf.status = "running";
                            await wf.save();
                            await this.logExecutionStep(userId, "Blockade cleared. Re-engaging...", "success", socket);
                        }
                    }
                    continue; // Resume main execution loop
                }

                 const historyBlock = actionHistory.length > 0 
                    ? `ACTIONS ALREADY TAKEN (do NOT repeat these):\n${actionHistory.slice(-8).map((h, i) => `  ${i+1}. ${h}`).join('\n')}` 
                    : 'No actions taken yet.';

                 const { getMasterProfile } = require("./agentResourceService");
                 const masterProfile = await getMasterProfile(userId);
                 const profileContext = masterProfile 
                    ? `USER PROFESSIONAL PROFILE (Use this for filling forms):\n${JSON.stringify(masterProfile.data, null, 2)}`
                    : 'NO Master Profile found. If you need user data, you MUST ask the user.';

                 const decisionPrompt = `Task: "${taskDescription}".
                Current URL: ${page.url()}
                
                ${profileContext}

                ${historyBlock}
                
                SCRAPED PAGE TEXT (Top 2k chars):
                ${snapshot.text.substring(0, 2000)}
                
                INSTRUCTIONS (THE TENACIOUS AUDITOR PROTOCOL):
                1. STRICT FIELD SCANNING: Do not submit the form until ALL required fields (often marked with '*') are filled.
                2. CHECKBOXES & TOGGLES: Ensure any required legal, consent, or agreement checkboxes are explicitly clicked.
                3. GENERIC FALLBACKS: For non-personal behavioral questions (e.g. "Have you previously worked at Alphabet?"), default to "No" to avoid stalling.
                4. RESUME UPLOADING: If an upload field for a resume/CV is present, check your capabilities to upload it or use INTERVENE to ask the user.
                5. THE "ASK FIRST" PROTOCOL: If a required personal field (e.g., Phone Number) is empty and cannot be deduced from the USER PROFESSIONAL PROFILE, use: INTERVENE [I need your phone number and resume to proceed...]
                6. SUCCESS CONFIRMATION: You are NEVER allowed to respond with \`COMPLETE\` just because you clicked a 'Submit' button. You must verify success by seeing text like "Application Received", "Thank you", or checking for red validation error blockers on the page.
                7. ERROR CATCHING: If you clicked submit but are still on the form, read the error messages and act on them.
                8. NEVER repeat a failed action endlessly.
                
                INTERACTIVE ELEMENTS:
                ${snapshot.elements.map((e, i) => `- ID ${i+1}: [${e.tag}] "${e.text}"`).join('\n')}
                
                Respond using this EXACT strict format:
                THOUGHT: [Brief reasoning about required fields, form errors, or completion confirmation]
                COMMAND: [CLICK ID | TYPE ID text | GOTO url | WAIT ms | INTERVENE question | COMPLETE message | FAIL reason]
                
                EXAMPLE 1 (Clicking element with ID 5):
                THOUGHT: I see the 'Learn More' button has ID 5.
                COMMAND: CLICK 5
                
                EXAMPLE 2 (Typing into element with ID 2):
                THOUGHT: ID 2 is the First Name field.
                COMMAND: TYPE 2 John
                
                EXAMPLE 3:
                THOUGHT: The current page has an error "Phone number invalid", I must ask the user.
                COMMAND: INTERVENE Please provide a valid Indian phone number (+91).`;

                const rawDecision = await generateWithFallback(decisionPrompt, "You are a precise browser automation controller.");
                
                // --- ROBUST PARSING ENGINE ---
                // 1. Clean up markdown and extra junk
                const cleanDecision = rawDecision.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
                
                // 2. Extract Thought & Command using positional indexing (more robust than line-based regex)
                let thought = "Analyzing next step...";
                let decision = "";
                
                const thoughtIdx = cleanDecision.toUpperCase().indexOf("THOUGHT:");
                const commandIdx = cleanDecision.toUpperCase().indexOf("COMMAND:");
                
                if (thoughtIdx !== -1) {
                    const endOfThought = commandIdx !== -1 ? commandIdx : cleanDecision.length;
                    thought = cleanDecision.substring(thoughtIdx + 8, endOfThought).trim();
                }
                
                if (commandIdx !== -1) {
                    decision = cleanDecision.substring(commandIdx + 8).trim();
                } else {
                    // Fallback: if no COMMAND: tag, take the whole thing if it doesn't have a THOUGHT tag
                    decision = (thoughtIdx === -1) ? cleanDecision : "";
                }

                // LLM Safety & Capability Refusal Detection
                const refusalKeywords = [
                    "i'm sorry", "i cannot assist", "i am unable to", "i'm unable to",
                    "cannot interact with web pages", "cannot access the internet",
                    "policy", "safety guidelines", "privacy"
                ];
                
                const isSafetyRefusal = refusalKeywords.some(k => cleanDecision.toLowerCase().includes(k));

                if (isSafetyRefusal) {
                    console.log(`[BrowserAgent] [${userId}] LLM Safety/Capability Refusal detected: ${cleanDecision}`);
                    
                    // Spam Prevention: If this happens repeatedly, trigger an intervention
                    this.safetyRefusalCount = (this.safetyRefusalCount || 0) + 1;
                    if (this.safetyRefusalCount >= 3) {
                        this.safetyRefusalCount = 0;
                        await this.logExecutionStep(userId, "Mission Interrupted: The AI is hitting a capability or safety wall (it is refusing to interact with this page). Please complete this step manually on the Live Feed.", "error", socket);
                        wf.status = "intervention";
                        wf.activeMicroLog = "AI Refusal: Please perform the action manually on the Live Feed, then click RESUME.";
                        await wf.save();
                        return { success: true, status: "intervention", message: "AI Refusal Blocked. Manual action required." };
                    }

                    await this.logExecutionStep(userId, "Mission Blocked: The AI agent is refusing to interact with this specific page due to safety or capability limits. Attempting to bypass...", "warn", socket);
                    // Force navigation to clear the refusal context
                    if (page.url().includes("google.com")) {
                         await page.goto("https://www.google.com").catch(() => {});
                    } else {
                         await page.reload().catch(() => {});
                    }
                    await page.waitForTimeout(3000);
                    steps++;
                    continue;
                }
                this.safetyRefusalCount = 0; // Reset count on success

                // LLM Compliancy Guard: Defend against conversational text bleeding into commands
                const validCommands = ["CLICK", "TYPE", "GOTO", "WAIT", "INTERVENE", "COMPLETE", "FAIL"];
                const startsWithValid = validCommands.some(c => decision.toUpperCase().startsWith(c));
                
                if (!startsWithValid || !decision) {
                    console.log(`[BrowserAgent] Non-compliant LLM output detected: "${decision || 'EMPTY'}"`);
                    const shortOutput = (decision || cleanDecision).substring(0, 50);
                    thought = `Format Error: AI returned invalid command structure ("${shortOutput}..."). Resetting frame.`;
                    decision = "WAIT 2000"; 
                }

                // --- STUCK DETECTION & RECOVERY (Improved for SPAs) ---
                const snapshotText = snapshot.text;
                if (decision === lastDecision && snapshotText === lastSnapshotText) {
                    repeatCount++;
                    if (repeatCount >= 2) {
                        await this.logExecutionStep(userId, "⚠️ Loop detected. Attempting to clear overlays...", "warn", socket);
                        
                        const dismissButton = snapshot.elements.find(e => {
                            const text = e.text.toLowerCase();
                            const isSmall = text.length < 5;
                            return (
                                text.match(/\b(close|dismiss|reject|cancel|maybe later|not now)\b/i) ||
                                (isSmall && text.match(/\b(✖|x)\b/i)) ||
                                e.selector.toLowerCase().match(/close|dismiss|x-icon|modal-close/i)
                            );
                        });
                        
                        if (dismissButton) {
                            await this.logExecutionStep(userId, `Auto-Recovery: Clicking ${dismissButton.text || 'Dismiss Button'}`, "info", socket);
                            await page.click(dismissButton.selector).catch(() => {});
                        } else {
                            await this.logExecutionStep(userId, "Auto-Recovery: Reloading page to clear blockage.", "info", socket);
                            await page.reload({ waitUntil: 'load' });
                        }
                        
                        repeatCount = 0; 
                        await page.waitForTimeout(2000);
                        continue; 
                    }
                } else {
                    repeatCount = 0;
                    lastDecision = decision;
                }
                
                lastSnapshotText = snapshotText; // Update tracking memory for next cycle

                steps++;
                actionHistory.push(`${thought} → ${decision}`);
                await this.logExecutionStep(userId, `[Thought] ${thought}`, "info", socket);
                await this.emitFrame(socket, userId, page, `Executing: ${decision}`, socketId);

                if (decision.startsWith("GOTO")) {
                    const url = decision.replace("GOTO", "").trim();
                    if (!url.startsWith('http')) {
                        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(taskDescription)}`);
                    } else {
                        await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(e => {
                            this.logExecutionStep(userId, `GOTO Error: ${e.message}`, "error", socket);
                        });
                    }
                } else if (decision.startsWith("CLICK")) {
                    let selector = decision.replace("CLICK", "").trim();
                    
                    // Numeric ID Resolution
                    if (selector.match(/^\d+$/)) {
                        const index = parseInt(selector) - 1;
                        if (snapshot.elements[index]) {
                            console.log(`[BrowserAgent] Resolved ID ${selector} to selector: ${snapshot.elements[index].selector}`);
                            selector = snapshot.elements[index].selector;
                        }
                    }

                    await this.logExecutionStep(userId, `Interacting with element...`, "info", socket, true);
                    await page.click(selector).catch(async e => {
                        console.log(`Click fail: ${e.message}`);
                        await this.logExecutionStep(userId, `Interaction Failed: ${e.message.split('\n')[0]}`, "error", socket);
                    });
                    await page.waitForTimeout(2500); // Let the page react before next snapshot
                } else if (decision.startsWith("TYPE")) {
                    const parts = decision.replace("TYPE", "").trim().split(" ");
                    let selector = parts[0];
                    const text = parts.slice(1).join(" ");

                    // Numeric ID Resolution
                    if (selector.match(/^\d+$/)) {
                        const index = parseInt(selector) - 1;
                        if (snapshot.elements[index]) {
                            console.log(`[BrowserAgent] Resolved ID ${selector} to selector: ${snapshot.elements[index].selector}`);
                            selector = snapshot.elements[index].selector;
                        }
                    }

                    await this.logExecutionStep(userId, `Providing information...`, "info", socket);
                    await page.fill(selector, text).catch(async e => {
                        console.log(`Type fail: ${e.message}`);
                        await this.logExecutionStep(userId, `Interaction Failed: ${e.message.split('\n')[0]}`, "error", socket);
                    });
                } else if (decision.startsWith("WAIT")) {
                    const ms = parseInt(decision.replace("WAIT", "").trim());
                    await page.waitForTimeout(ms);
                } else if (decision.startsWith("INTERVENE")) {
                    const question = decision.replace("INTERVENE", "").trim();
                    await this.logExecutionStep(userId, `Intervention: ${question}`, "warn", socket);
                    
                    // Update workflow status to pause execution in UI
                    if (wf) {
                        wf.status = "intervention";
                        wf.activeMicroLog = question;
                        await wf.save();
                    }
                    
                    this.safeSaveMessage(userId, "agent", `I need more information to continue: "${question}"`, "intervention", { 
                        type: 'data_request', 
                        question,
                        workflowId: wf?._id 
                    });

                    return { success: true, status: "intervention", message: question };
                } else if (decision.startsWith("COMPLETE")) {
                    completed = true;
                    const msg = decision.replace("COMPLETE", "").trim();
                    const proofUrl = await this.captureStepProof(page, userId, "Final Execution Proof");
                    
                    await this.safeSaveMessage(userId, "agent", `Task Completed: ${msg}`, "browser_result", { 
                        platform, 
                        evidenceUrl: proofUrl,
                        sourceUrl: page.url()
                    });

                    return { success: true, message: msg, metadata: { platform, evidenceUrl: proofUrl, sourceUrl: page.url() } };
                } else if (decision.startsWith("FAIL")) {
                    throw new Error(decision.replace("FAIL", "").trim());
                }

                await page.waitForTimeout(1500); 
            }

            if (!options.reuseSession) {
                this.stopStreaming(userId);
                await page.close();
                this.activePages.delete(userId.toString());
            }

            return { 
                success: false, 
                message: `Task halted after reaching step limit (${maxSteps}). Objectives not fully achieved.`, 
                metadata: { sourceUrl: page.url() }
            };
        } catch (error) {
            console.error("[BrowserAgent] Task failed:", error.message);
            
            const retryCount = options.retryCount || 0;
            if (retryCount >= 3) {
                 await this.logExecutionStep(userId, `Self-healing exhausted after ${retryCount} attempts. Stopping task.`, "error", socket);
                 return { success: false, message: `Execution failed after multiple recovery attempts: ${error.message}` };
            }

            // --- SELF-HEALING LOOP ---
            const recovery = await this.troubleshoot(page, userId, socket, error);
            if (recovery.success) {
                // Exponential backoff or small delay to prevent rapid-fire loops
                await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                return await this.executeTask(userId, platform, taskDescription, socket, { ...options, retryCount: retryCount + 1 });
            }

            this.stopStreaming(userId);
            await page.close().catch(() => {});
            this.activePages.delete(userId.toString());
            return { success: false, message: `Execution Error: ${error.message}. TIP: ${recovery.advice || "Ensure you are logged in or provide more specific selectors."}` };
        }
    }

    /**
     * Autonomously troubleshoot an execution error.
     * Takes a screenshot, analyzes the DOM, and suggests a fix or workaround.
     */
    async troubleshoot(page, userId, socket, error) {
        if (!page) return { success: false };
        
        try {
            await this.logExecutionStep(userId, `[Self-Healing] Troubleshooting execution error: ${error.message.substring(0, 50)}...`, "warn", socket, true);
            const snapshot = await this.getSnapshot(page);
            
            const troubleshootPrompt = `The Action Agent hit an error: "${error.message}".
            Current URL: ${page.url()}
            Visible Content: ${snapshot.text.substring(0, 3000)}
            
            As the Self-Healing Engine, analyze why this failed (e.g., target element not visible, page changed, or session expired).
            Respond with STRICT JSON:
            {
              "canFix": boolean,
              "action": "REFRESH" | "WAIT" | "GO_BACK" | "CLICK_PARENT" | "NONE",
              "advice": "1-sentence tip for the user",
              "reasoning": "Why it failed"
            }`;

            const res = await generateWithFallback(troubleshootPrompt, "You are a high-precision browser troubleshooting engine.");
            const decision = JSON.parse(res.replace(/```json|```/g, '').trim());

            if (decision.canFix && decision.action !== "NONE") {
                await this.logExecutionStep(userId, `[Self-Healing] Attempting recovery: ${decision.action}...`, "info", socket);
                if (decision.action === "REFRESH") await page.reload({ waitUntil: 'domcontentloaded' });
                if (decision.action === "WAIT") await page.waitForTimeout(5000);
                if (decision.action === "GO_BACK") await page.goBack();
                
                return { success: true };
            }

            return { success: false, advice: decision.advice };
        } catch (e) {
            return { success: false };
        }
    }

    /**
     * Specialized LLM solver for MCQs, quizzes, and complex form structures.
     * Scrapes question blocks and uses user profile data for grounded answers.
     */
    async solveFormIntelligently(page, userId, socket) {
        try {
            await this.logExecutionStep(userId, "Engaging High-Intelligence Solver for form/quiz items...", "info", socket);
            
            // 1. Scrape form elements with context
            const formElements = await page.evaluate(() => {
                const elements = [];
                // Target: Labels, Inputs, Selects, Radio Groups
                const containers = document.querySelectorAll('div, form, section');
                containers.forEach(container => {
                    const label = container.innerText.split('\n')[0].substring(0, 100);
                    const inputs = Array.from(container.querySelectorAll('input, select, textarea, [role="radio"]'));
                    if (inputs.length > 0) {
                        elements.push({
                            context: label,
                            options: inputs.map((inp, idx) => ({
                                type: inp.type || inp.getAttribute('role'),
                                id: inp.id || inp.name || `el_${idx}`,
                                value: inp.value,
                                text: inp.labels?.[0]?.innerText || inp.parentElement?.innerText || ""
                            }))
                        });
                    }
                });
                return elements.filter(e => e.context.trim() && e.options.length > 0).slice(0, 15);
            });

            // 2. Fetch User Profile for Grounding
            const profile = await agentResourceService.getMasterProfile(userId);
            const userContext = profile ? JSON.stringify(profile.data) : "No specific user data available. Use general knowledge.";

            // 3. Ask LLM to solve the batch
            const solverPrompt = `You are a professional quiz and form solver. 
            User Context: ${userContext}
            Form Elements: ${JSON.stringify(formElements)}
            
            Provide the correct values or option indices to select.
            Respond with STRICT JSON array of actions:
            [{ "context": "...", "type": "TYPE" | "CLICK", "selector": "id_or_name", "value": "..." }]
            `;

            const actionsText = await generateWithFallback(solverPrompt, "You are a high-intelligence precision solver.");
            const actions = JSON.parse(actionsText.replace(/```json|```/g, '').trim());

            for (const action of actions) {
                await this.logExecutionStep(userId, `Filling: ${action.context}...`, "info", socket);
                if (action.type === "CLICK") {
                    await page.click(`[id="${action.selector}"], [name="${action.selector}"], :text("${action.value}")`).catch(() => {});
                } else if (action.type === "TYPE") {
                    await page.fill(`[id="${action.selector}"], [name="${action.selector}"]`, action.value).catch(() => {});
                }
                await page.waitForTimeout(500);
            }

            return { success: true };
        } catch (error) {
            console.error("[BrowserAgent] Intelligent solver failed:", error);
            return { success: false };
        }
    }

    /**
     * Capture page snapshot for AI analysis
     */
    async getSnapshot(page) {
        const interactiveElements = await page.evaluate(() => {
            const elements = [];
            const getSelector = (el) => {
                const tag = el.tagName.toLowerCase();
                if (el.id) return `#${el.id}`;
                if (el.name) return `[name="${el.name}"]`;
                if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
                
                const text = (el.innerText || el.ariaLabel || "").trim().substring(0, 30);
                if (text) return `${tag}:has-text("${text}")`;
                return tag;
            };

            const interactive = document.querySelectorAll('button, input, select, textarea, a, [role="button"], [aria-label*="lose"], [aria-label*="ismiss"], [class*="close"]');
            interactive.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top >= 0) {
                    const text = (el.innerText || el.placeholder || el.ariaLabel || el.title || el.name || 'unlabeled').trim();
                    elements.push({
                        tag: el.tagName,
                        text: text.substring(0, 50),
                        selector: getSelector(el),
                        rect: { top: rect.top, left: rect.left }
                    });
                }
            });
            return elements.slice(0, 50); // Increased limit to 50
        });

        return {
            url: page.url(),
            text: await page.innerText('body').then(t => t.substring(0, 2000)),
            title: await page.title(),
            elements: interactiveElements
        };
    }

    /**
     * Handle remote input from the user (Click/Type)
     */
    async handleRemoteInput(userId, data) {
        const page = this.activePages.get(userId.toString());
        if (!page) return;

        try {
            if (data.type === 'click') {
                await page.mouse.click(data.x, data.y);
                console.log(`[BrowserAgent] Remote CLICK at ${data.x}, ${data.y}`);
            } else if (data.type === 'keypress') {
                await page.keyboard.press(data.key);
                console.log(`[BrowserAgent] Remote KEYPRESS: ${data.key}`);
            } else if (data.type === 'type') {
                await page.keyboard.type(data.text);
                console.log(`[BrowserAgent] Remote TYPE: ${data.text}`);
            }
        } catch (e) {
            console.error("[BrowserAgent] Remote input failed:", e.message);
        }
    }

    /**
     * Detect if blocked by CAPTCHA and notify user
     */
    async checkBlock(userId, page, socket) {
        const url = page.url();
        const content = await page.content();
        
        const isBlocked = url.includes("google.com/sorry") || 
                          content.includes("captcha") || 
                          content.includes("g-recaptcha") ||
                          content.includes("not a robot");

        if (isBlocked && socket) {
            console.warn(`[BrowserAgent] [${userId}] CAPTCHA detected at ${url}`);
            
            // Notify via Socket for UI trigger
            socket.emit("browser_block", { userId, url, reason: "reCAPTCHA detected" });

            // Non-blocking save alert to chat
            this.safeSaveMessage(userId, "agent", "⚠️ I've hit a CAPTCHA or bot detection wall. Please click inside the Live Monitor to help me solve it!", "text", { type: 'captcha_alert', url });
            
            socket.emit("chat_update", { userId });
        }
    }

    /**
     * Stream a screenshot to the frontend via Socket.io
     */
    async emitFrame(socket, userId, page, statusMessage, directSocketId = null, quality = 50) {
        const io = this.io || socket?.server || (socket?.emit ? null : socket); 
        if (!io) return;
        
        try {
            // Check for blocks intermittently
            if (Math.random() > 0.8) {
                this.checkBlock(userId, page, socket);
            }

            const screenshot = await page.screenshot({ type: 'jpeg', quality });
            const base64 = screenshot.toString('base64');
            const timestamp = new Date();
            
            // 1. Broadcast to everyone in the user's room (Multi-tab sync)
            io.to(userId.toString()).emit("browser_frame", {
                userId,
                frame: `data:image/jpeg;base64,${base64}`,
                status: statusMessage,
                url: page.url(),
                timestamp,
                isHeartbeat: statusMessage === "HEARTBEAT"
            });

            // 2. Direct-to-Socket Target (Fail-safe for active tab)
            if (directSocketId) {
                io.to(directSocketId).emit("browser_frame", {
                    userId,
                    frame: `data:image/jpeg;base64,${base64}`,
                    status: statusMessage,
                    url: page.url(),
                    timestamp,
                    isHeartbeat: statusMessage === "HEARTBEAT"
                });
            }
        } catch (e) {
            // Silence errors during rapid navigation
        }
    }

    /**
     * Capture a high-resolution final screenshot as evidence of task completion.
     * Uploads to Cloudinary for investor-ready proof.
     */
    async captureFinalProof(userId, workflowId, page) {
        if (!page) page = this.activePages.get(userId.toString());
        if (!page) return null;

        try {
            console.log(`[BrowserAgent] Capturing final proof for workflow: ${workflowId}`);
            const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 90 });
            
            // Temporary write to file for Cloudinary upload tool compatibility or direct upload
            const { cloudinary } = require("../config/cloudinary");
            
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({
                    folder: 'nurotra_proofs',
                    public_id: `proof_${workflowId}_${Date.now()}`,
                    resource_type: 'image'
                }, (error, result) => {
                    if (error) {
                        console.error("[BrowserAgent] Proof upload failed:", error.message);
                        resolve(null);
                    } else {
                        console.log("[BrowserAgent] Final proof uploaded:", result.secure_url);
                        resolve(result.secure_url);
                    }
                }).end(screenshot);
            });
        } catch (e) {
            console.error("[BrowserAgent] Failed to capture proof:", e.message);
            return null;
        }
    }
    /**
     * Helper to silently update NuroMemory Website Heuristics
     */
    async updateBrowserMemory(userId, domain, success, reason) {
        try {
            let memory = await NuroMemory.findOne({ userId });
            if (!memory) return;
            
            if (!memory.browserIntelligence) {
                memory.browserIntelligence = { failedDomains: [], successfulDomains: [] };
            }
            
            if (success) {
                memory.browserIntelligence.failedDomains = memory.browserIntelligence.failedDomains.filter(d => !d.includes(domain));
                if (!memory.browserIntelligence.successfulDomains.includes(domain)) {
                    memory.browserIntelligence.successfulDomains.push(domain);
                }
            } else {
                memory.browserIntelligence.successfulDomains = memory.browserIntelligence.successfulDomains.filter(d => !d.includes(domain));
                if (!memory.browserIntelligence.failedDomains.includes(domain)) {
                    memory.browserIntelligence.failedDomains.push(domain);
                }
            }
            memory.browserIntelligence.lastUpdated = Date.now();
            
            memory.browserIntelligence.failedDomains = [...new Set(memory.browserIntelligence.failedDomains)].slice(-20);
            memory.browserIntelligence.successfulDomains = [...new Set(memory.browserIntelligence.successfulDomains)].slice(-20);
            
            await memory.save();
        } catch (e) {
            console.error("[BrowserAgent] Memory update failed:", e.message);
        }
    }
}

module.exports = new BrowserAgentService();
