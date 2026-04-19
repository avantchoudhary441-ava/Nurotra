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
        }).save().catch(err => {
            console.error(`[BrowserAgent] Non-blocking DB save failed for ${userId}:`, err.message);
        });
    }

    /**
     * Log a granular execution step to the active workflow for the user.
     */
    async logExecutionStep(userId, message, status = "info", socket = null) {
        try {
            // Find the most recent running workflow for this user
            const wf = await ActionWorkflow.findOne({ userId, status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } }).sort({ startTime: -1 });
            if (!wf) return;

            wf.executionLogs.push({
                stepLabel: "Browser Agent",
                status,
                message,
                timestamp: new Date(),
                level: status
            });
            wf.activeMicroLog = message;
            await wf.save();

            if (socket) {
                socket.emit("task_update", { userId, workflowId: wf._id });
            }
        } catch (err) {
            console.error(`[BrowserAgent] Failed to log step for ${userId}:`, err.message);
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
    async searchInfo(userId, query, socket = null, skipSave = false) {
        let currentProvider = 'Google';
        let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        const context = await this.getContext(userId);
        const page = await context.newPage();
        this.activePages.set(userId.toString(), page);
        
        // Instant reality: Show the browser immediately
        await this.emitFrame(socket, userId, page);
        
        try {
            console.log(`[BrowserAgent] Searching for: "${query}" using ${currentProvider}`);
            await this.logExecutionStep(userId, `Searching ${currentProvider} for: "${query}"`, "info", socket);
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

            // --- DEEP SEARCH LOGIC ---
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

            // 2. AI Decision: Snippet enough or Visit?
            let decision = "STAY"; 
            try {
                const decisionPrompt = `User Question: "${query}"
                
                Search Results Snippets:
                ${pageText.substring(0, 4000)}
                
                Available Links to Explore:
                ${links.map((l, i) => `[${i}] ${l.title} - ${l.url}`).join('\n')}
                
                Based on the snippets, choose the most efficient path:
                1. STAY [Summarized Answer]: Use this if the snippets or info-cards clearly show the definitive answer (e.g. "Scores are 145/2", "The winner was X"). Do NOT visit a site if the SERP snippet is sufficient.
                2. VISIT [URL]: Use this only if the snippets are vague, missing crucial data, or you need deep details that aren't visible on the search results page.
                3. NONE: Use this if absolutely nothing relevant is found.
                
                Respond with ONLY the command (STAY [text] or VISIT [url] or NONE). Be lazy but smart: prefer STAY if possible.`;

                decision = await generateWithFallback(decisionPrompt, "You are a web search strategist.", [], [], { forceJson: false });
                console.log(`[BrowserAgent] Search Decision: ${decision}`);
            } catch (err) {
                console.error(`[BrowserAgent] AI Decision failed (likely quota limit). Defaulting to STAY fallback: ${err.message}`);
                await this.emitFrame(socket, userId, page, "AI limit reached. Optimizing and using available snippets directly...");
                decision = "STAY"; // Absolute fallback to keep the workflow moving
            }

            let finalContent = pageText;
            let finalUrl = page.url();

            if (decision.startsWith("VISIT")) {
                let targetUrl = decision.replace("VISIT", "").trim();
                
                // Sanitize: Remove common AI wrappers like [ ], " ", ( )
                targetUrl = targetUrl.replace(/^[\[\("']+|[\]\)"']+$/g, '');
                
                // Validate protocol
                if (!targetUrl.startsWith('http')) {
                    targetUrl = 'https://' + targetUrl;
                }

                console.log(`[BrowserAgent] Deep-diving into: ${targetUrl}`);
                await this.logExecutionStep(userId, `Opening: ${targetUrl.split('/')[2]} for more details`, "info", socket);
                await this.emitFrame(socket, userId, page, `Opening: ${targetUrl.split('/')[2]} for more details...`);
                
                try {
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await page.waitForTimeout(1000); 
                    
                    // Trigger the visual scrolling effect to scan the page
                    await this.autoScrollAndStream(page, socket, userId);

                    finalContent = await page.innerText('body');
                    finalUrl = page.url();
                    await this.logExecutionStep(userId, "Deep page data extracted.", "success", socket);
                    await this.emitFrame(socket, userId, page, "Data extraction complete.");
                } catch (navErr) {
                    console.error(`[BrowserAgent] Deep navigation failed: ${navErr.message}. Falling back to snippets.`);
                    await this.emitFrame(socket, userId, page, "Site blocked/timed out. Falling back to search snippets...");
                }
            } else if (decision.startsWith("STAY")) {
                console.log("[BrowserAgent] Snippet extraction mode active.");
            }

            // --- QUOTA BREATHER ---
            // Small delay to prevent hitting RPM limits when making back-to-back calls
            await new Promise(r => setTimeout(r, 1500)); 

            // 3. Final Extraction: Business Grace & Conversational Follow-up
            await this.logExecutionStep(userId, "Completing professional strategic report...", "info", socket);
            const extractionPrompt = `User Question: "${query}"
            Current URL: ${finalUrl}
            
            TASK: As the Nurotra Professional Assistant, provide the final results of your investigation based EXCLUSIVELY on the provided content.
            
            TONE & PERSONALITY:
            - FOLLOW-UP CONNECTION: Frame this as a continuation of your initial acknowledgment. Use phrases like "I've successfully gathered those details for you..." or "As promised, here is the breakdown...".
            - BUSINESS GRACE: Maintain respectful, elegant, and simple language.
            - INTEGRATED NARRATIVE: Weave findings together naturally. 
            - PROACTIVE ASSISTANCE: NEVER tell the user to visit a website or check another platform themselves. Instead, offer to do it on their behalf (e.g., "If you want, I can visit [Website Name] or [Platform] on your behalf for further insights. Just let me know and I will execute it.").
            
            CONTENT REQUIREMENTS & ABSOLUTE ACCURACY:
            - AUTHENTIC DATA ONLY: NEVER hallucinate, invent, or use placeholder names like "Team A" or "Team B". You MUST extract and use only the REAL team names, scores, and facts from the CONTENT below.
            - NO GUESSING: If the actual data is barely mentioned or missing, simply state gracefully that the exact information is not currently detailed in the immediate sources, rather than making things up.
            - VISUAL CLARITY: Use clean bullet points (•) for data density. Bold keys where appropriate (**Team Name**: Detail).
            - COMPREHENSIVENESS: Include scores, dates, teams, and next schedules if applicable.
            
            SOURCE BRANDING:
            - At the end, add: "Source: ${finalUrl}"
            
            CONTENT TO ANALYZE:
            ${finalContent.substring(0, 10000)}`;

            const finalResult = await generateWithFallback(extractionPrompt, "You are the Nurotra Professional Strategic Assistant. Your voice is graceful, simple, and respectful.", [], [], { forceJson: false });
            
            if (!skipSave) {
                this.safeSaveMessage(userId, "agent", finalResult, "browser_result", { query, sourceUrl: finalUrl, provider: currentProvider });
            }

            console.log(`[BrowserAgent] [${userId}] Search completed.`);
            await page.close();
            return { success: true, answer: finalResult };

        } catch (error) {
            console.error("[BrowserAgent] Search failed:", error.message);
            await page.close().catch(() => {});
            throw error;
        }
    }

    /**
     * Perform an operational task (e.g., Update Sheet)
     */
    async executeTask(userId, platform, taskDescription, socket = null) {
        const context = await this.getContext(userId);
        const page = await context.newPage();
        this.activePages.set(userId.toString(), page);

        // Immediate wake up frame
        await this.emitFrame(socket, userId, page, "Preparing Virtual Workspace...");
        
        try {
            const integration = await Integration.findOne({ userId, platform });
            if (!integration && platform !== 'custom') {
                throw new Error(`Platform ${platform} not connected. Please connect it first.`);
            }

            // Logic for specific platforms would go here
            // For now, we use a generic AI-driven loop
            
            let completed = false;
            let steps = 0;
            const maxSteps = 10;

            while (!completed && steps < maxSteps) {
                const snapshot = await this.getSnapshot(page);
                await this.emitFrame(socket, userId, page, `Executing step ${steps + 1}: Analyzing dashboard...`);

                const decisionPrompt = `You are controlling a browser to perform this task: "${taskDescription}" on "${platform}".
                Current URL: ${page.url()}
                Page Content: ${snapshot.text.substring(0, 3000)}
                
                What should I do next? Choose one:
                1. GOTO [url]
                2. CLICK [selector]
                3. TYPE [selector] [text]
                4. WAIT [ms]
                5. COMPLETE [success message]
                6. FAIL [error message]
                
                Respond with ONLY the command.`;

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
                } else if (decision.startsWith("COMPLETE")) {
                    completed = true;
                    const msg = decision.replace("COMPLETE", "").trim();
                    
                    // Save result to chat history
                    await new ActionMessage({
                        userId,
                        role: "agent",
                        content: msg,
                        type: "browser_result",
                        metadata: { platform, taskDescription }
                    }).save();

                    return { success: true, message: msg };
                } else if (decision.startsWith("FAIL")) {
                    throw new Error(decision.replace("FAIL", "").trim());
                }

                steps++;
                await page.waitForTimeout(1000);
            }

            await page.close();
            
            const failPrompt = `The Action Agent was trying to: "${taskDescription}" on "${platform}".
            It stopped after ${steps} steps. 
            URL: ${page.url()}
            
            Provide a helpful summary for the user:
            - What we managed to see or do.
            - Why we might have stopped (e.g. reached page limit, couldn't find button).
            - Suggested Preparation: What should the user prepare or check to help the agent succeed next time?
            
            Return strictly plain text helpful advice.`;
            
            const failAdvice = await generateWithFallback(failPrompt, "You are a helpful automation troubleshooter.");
            return { success: true, message: `Task paused/incomplete. REASON: ${failAdvice}`, data: { advice: failAdvice } };
        } catch (error) {
            console.error("[BrowserAgent] Task failed:", error.message);
            await page.close();
            return { success: false, message: `Execution Error: ${error.message}. TIP: Ensure you are logged in or provide more specific selectors.` };
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
    async emitFrame(socket, userId, page, statusMessage) {
        const io = this.io || socket?.server; // Fallback to provided socket if global io not set
        if (!io) return;
        
        try {
            // Check for blocks every few frames
            if (Math.random() > 0.7) {
                this.checkBlock(userId, page, socket);
            }

            const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
            const base64 = screenshot.toString('base64');
            
            // Broadcast to the user's room so all tabs are synced
            io.to(userId.toString()).emit("browser_frame", {
                userId,
                frame: `data:image/jpeg;base64,${base64}`,
                status: statusMessage,
                url: page.url(),
                timestamp: new Date()
            });
        } catch (e) {
            console.warn("[BrowserAgent] Failed to emit frame:", e.message);
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
}

module.exports = new BrowserAgentService();
