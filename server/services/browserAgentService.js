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

            console.log(`[BrowserAgent] [${userId}] Session cleared.`);
            return true;
        } catch (e) {
            console.error(`[BrowserAgent] [${userId}] Failed to restart session:`, e.message);
            return false;
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
    async init() {
        if (!this.browser) {
            console.log("[BrowserAgent] Starting Chromium engine...");
            this.browser = await chromium.launch({
                headless: true, // Run invisible for speed
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
            });
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
        await this.init();
        
        if (this.activeContexts.has(userId.toString())) {
            return this.activeContexts.get(userId.toString());
        }

        // Try to load session data from Integration model
        let storageState = undefined;
        try {
            console.log(`[BrowserAgent] [${userId}] Fetching session integration...`);
            const integration = await Integration.findOne({ userId, platform: 'custom' }).maxTimeMS(2000); 
            
            if (integration?.sessionData?.cookies) {
                storageState = {
                    cookies: integration.sessionData.cookies,
                    origins: Object.entries(integration.sessionData.localStorage || {}).map(([origin, storage]) => ({
                        origin,
                        localStorage: Object.entries(storage).map(([name, value]) => ({ name, value }))
                    }))
                };
            }
        } catch (dbErr) {
            console.warn(`[BrowserAgent] [${userId}] DB lookup for integration timed out/failed. Proceeding with clean session.`);
        }

        console.log(`[BrowserAgent] [${userId}] Creating new browser context...`);
        const context = await this.browser.newContext({
            storageState,
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        });

        this.activeContexts.set(userId.toString(), context);
        return context;
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
        
        // Instant reality: Show the browser immediately
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
            const extractionPrompt = `You are an expert Data Extraction Engine.
            Task: ${query}
            
            Current URL: ${finalUrl}
            
            CRITICAL RULES:
            1. EXTRACT REAL DATA: Pull out actual numbers, scores, dates, names, facts, statistics that are visible in the content. (e.g., "• **Mumbai Indians**: 178/4 vs **CSK**: 162/8").
            2. NEVER list or describe websites. The user wants the DATA, not a directory of sources.
            3. If actual data IS present, extract and present it beautifully with bullet points.
            4. If the actual data is genuinely NOT in the content, say "I couldn't find the exact status on ${finalUrl} after exploring." and state what is still outstanding.
            5. NEVER ask 'Would you like me to go deep?'. Summarize the best information discovered.
            6. NEVER hallucinate or invent data. Only use what's actually in the CONTENT below.
            7. NEVER tell the user to visit a website themselves.
            8. DATA PRIORITY: For 'latest status', present it as "Status as of [Time/Date]: [Details]".
            
            FORMAT:
            - Use bullet points (•) for data items
            - Bold key names (**Team**: Score)
            - Keep it concise and data-dense
            - End with: "Source: ${finalUrl}"
            
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
        let page = this.activePages.get(userId.toString());
        const context = await this.getContext(userId);

        if (!page || page.isClosed()) {
            page = await context.newPage();
            this.activePages.set(userId.toString(), page);
        } else {
            console.log(`[BrowserAgent] [${userId}] Reusing existing session for task execution...`);
        }

        // Immediate wake up frame
        await this.emitFrame(socket, userId, page, "Preparing Virtual Workspace...");
        
        try {
            await this.logExecutionStep(userId, "Virtual workspace initialized.", "info", socket, false, executionSteps);
            const integration = await Integration.findOne({ userId, platform });
            if (!integration && platform !== 'custom') {
                throw new Error(`Platform ${platform} not connected. Please connect it first.`);
            }

            // Logic for specific platforms would go here
            // For now, we use a generic AI-driven loop
            this.io = socket?.server || socket; // Set the IO instance for this session
            const socketId = options.socketId || null;
            
            let completed = false;
            let steps = 0;
            const maxSteps = 10;

            while (!completed && steps < maxSteps) {
                const snapshot = await this.getSnapshot(page);
                await this.emitFrame(socket, userId, page, `Executing step ${steps + 1}: Analyzing dashboard...`, socketId);

                const decisionPrompt = `You are controlling a browser to perform this task: "${taskDescription}" on "${platform}".
                Current URL: ${page.url()}
                Page Content: ${snapshot.text.substring(0, 3000)}
                
                What should I do next? Choose one:
                1. GOTO [url]
                2. CLICK [selector]
                3. TYPE [selector] [text]
                4. WAIT [ms]
                5. INTERVENE [A question for the user asking for missing data/files]
                6. COMPLETE [success message]
                7. FAIL [error message]
                
                Respond with ONLY the command. If you find a form that requires data you don't have (like a phone number, specific file, or SSN), use INTERVENE to ask the user.`;

                const decision = await generateWithFallback(decisionPrompt, "You are a browser automation controller.");
                console.log(`[BrowserAgent] Decision: ${decision}`);

                if (decision.startsWith("GOTO")) {
                    const url = decision.replace("GOTO", "").trim();
                    await this.logExecutionStep(userId, `Navigating to ${url}`, "info", socket);
                    await this.emitFrame(socket, userId, page, `Navigating to ${url}...`);
                    await page.goto(url);
                    await this.emitFrame(socket, userId, page, `Arrived at ${url}`);
                } else if (decision.startsWith("CLICK")) {
                    const selector = decision.replace("CLICK", "").trim();
                    await this.logExecutionStep(userId, `Clicking on element ${selector}`, "info", socket);
                    await this.emitFrame(socket, userId, page, `Clicking...`);
                    await page.click(selector);
                    await this.emitFrame(socket, userId, page, `Clicked element`);
                } else if (decision.startsWith("TYPE")) {
                    const parts = decision.replace("TYPE", "").trim().split(" ");
                    const selector = parts[0];
                    const text = parts.slice(1).join(" ");
                    await this.logExecutionStep(userId, `Typing text into ${selector}`, "info", socket);
                    await this.emitFrame(socket, userId, page, `Typing...`);
                    await page.fill(selector, text);
                    await this.emitFrame(socket, userId, page, `Finished typing`);
                } else if (decision.startsWith("WAIT")) {
                    const ms = parseInt(decision.replace("WAIT", "").trim());
                    await this.logExecutionStep(userId, `Waiting for ${ms}ms`, "info", socket);
                    await page.waitForTimeout(ms);
                } else if (decision.startsWith("INTERVENE")) {
                    const question = decision.replace("INTERVENE", "").trim();
                    await this.logExecutionStep(userId, `Waiting for user: ${question}`, "warn", socket);
                    
                    // Update workflow status to intervention
                    const wf = await ActionWorkflow.findOne({ userId, status: "running" }).sort({ startTime: -1 });
                    if (wf) {
                        wf.status = "intervention";
                        wf.activeMicroLog = question;
                        await wf.save();
                    }

                    // Save the question into chat
                    await this.safeSaveMessage(userId, "agent", `I need your help: ${question}`, "clarification");
                    
                    if (this.io) this.io.to(userId.toString()).emit("chat_update", { userId });
                    
                    return { success: true, status: "intervention", message: question };
                } else if (decision.startsWith("COMPLETE")) {
                    completed = true;
                    const msg = decision.replace("COMPLETE", "").trim();
                    
                    // CAPTURE FINAL PROOF
                    let evidenceUrl = null;
                    try {
                        evidenceUrl = await this.captureStepProof(page, userId, `Task execution proof for: ${taskDescription}`);
                    } catch (err) {
                        console.error("[BrowserAgent] Task proof capture failed:", err.message);
                    }

                    // Save result to chat history
                    await this.safeSaveMessage(userId, "agent", msg, "browser_result", { 
                        platform, 
                        taskDescription,
                        evidenceUrl,
                        sourceUrl: page.url()
                    });

                    return { 
                        success: true, 
                        message: msg,
                        metadata: {
                            platform,
                            taskDescription,
                            evidenceUrl,
                            sourceUrl: page.url()
                        }
                    };
                } else if (decision.startsWith("FAIL")) {
                    throw new Error(decision.replace("FAIL", "").trim());
                }

                steps++;
                await page.waitForTimeout(1000);
            }

            if (!options.reuseSession) {
                await page.close();
                this.activePages.delete(userId.toString());
            }
            
            const failPrompt = `The Action Agent was trying to: "${taskDescription}" on "${platform}".
            It stopped after ${steps} steps. 
            URL: ${page.url()}
            
            Provide a helpful summary for the user:
            - What we managed to see or do.
            - Why we might have stopped (e.g. reached page limit, couldn't find button).
            - Suggested Preparation: What should the user prepare or check to help the agent succeed next time?
            
            Return strictly plain text helpful advice.`;
            
            const failAdvice = await generateWithFallback(failPrompt, "You are a helpful automation troubleshooter.");
            return { 
                success: true, 
                message: `Task paused/incomplete. REASON: ${failAdvice}`, 
                data: { advice: failAdvice },
                metadata: {
                    sourceUrl: page.url()
                }
            };
        } catch (error) {
            console.error("[BrowserAgent] Task failed:", error.message);
            
            // --- SELF-HEALING LOOP ---
            const recovery = await this.troubleshoot(page, userId, socket, error);
            if (recovery.success) {
                return await this.executeTask(userId, platform, taskDescription, socket, { ...options, retryCount: (options.retryCount || 0) + 1 });
            }

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
        return {
            url: page.url(),
            text: await page.innerText('body'),
            title: await page.title()
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
    async emitFrame(socket, userId, page, statusMessage, directSocketId = null) {
        const io = this.io || socket?.server || (socket?.emit ? null : socket); 
        if (!io) return;
        
        try {
            // Check for blocks intermittently
            if (Math.random() > 0.8) {
                this.checkBlock(userId, page, socket);
            }

            const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
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
