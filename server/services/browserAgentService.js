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
const { generateWithFallback } = require("./aiService");

class BrowserAgentService {
    constructor() {
        this.browser = null;
        this.activeContexts = new Map(); // userId -> browserContext
        this.activePages = new Map(); // userId -> Page
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
     * Initialize the browser instance if not already running
     */
    async init() {
        if (!this.browser) {
            console.log("[BrowserAgent] Starting Chromium engine...");
            this.browser = await chromium.launch({
                headless: true, // Run invisible for speed
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
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
        
        try {
            console.log(`[BrowserAgent] Searching for: "${query}" using ${currentProvider}`);
            await this.emitFrame(socket, userId, page, `Searching ${currentProvider} for: "${query}"...`);
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Detection for CAPTCHA/Blocks
            let isBlocked = page.url().includes("google.com/sorry") || (await page.content()).includes("captcha");

            if (isBlocked) {
                console.warn(`[BrowserAgent] Block detected. Switching to DuckDuckGo...`);
                await this.emitFrame(socket, userId, page, "Search blocked. Switching to backup engine (DuckDuckGo)...");
                currentProvider = 'DuckDuckGo';
                searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(1500); 
            }

            // --- DEEP SEARCH LOGIC ---
            await this.emitFrame(socket, userId, page, `Analyzing results for "${query}"...`);
            
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
                
                Based on the snippets, choose the best path:
                1. If the snippets ALREADY contain the definitive, full answer, respond: "STAY [Summarized Answer]"
                2. If you need to visit a site for a better/full answer, respond: "VISIT [URL]"
                3. If no results are relevant, respond: "NONE"
                
                Respond with ONLY the command (STAY [text] or VISIT [url] or NONE).`;

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
                const targetUrl = decision.replace("VISIT", "").trim();
                console.log(`[BrowserAgent] Deep-diving into: ${targetUrl}`);
                await this.emitFrame(socket, userId, page, `Opening: ${targetUrl.split('/')[2]} for detailed data...`);
                
                try {
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await page.waitForTimeout(1500); // Allow JS widgets to load
                    finalContent = await page.innerText('body');
                    finalUrl = page.url();
                    await this.emitFrame(socket, userId, page, "Deep page data extracted.");
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

            // 3. Final Extraction
            const extractionPrompt = `User Question: "${query}"
            Current URL: ${finalUrl}
            
            EXTRACT the EXACT answer from the web content below. Format your response as STRUCTURED TEXT:
            
            RULES:
            1. Start with a one-line status/headline in CAPS (e.g., "STATUS: RCB WON BY 4 WICKETS")
            2. Use bullets (•) for individual facts (scores, dates, CEO name, etc.)
            3. Use "Label: Value" format for pairs
            4. End with "Source: [The specific URL visited]"
            5. If not found, say "⚠ Information not found in current view"
            
            CONTENT:
            ${finalContent.substring(0, 8000)}`;

            const finalResult = await generateWithFallback(extractionPrompt, "You are a real-time data extraction engine.", [], [], { forceJson: false });
            
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
                    await page.goto(url);
                } else if (decision.startsWith("CLICK")) {
                    const selector = decision.replace("CLICK", "").trim();
                    await page.click(selector);
                } else if (decision.startsWith("TYPE")) {
                    const parts = decision.replace("TYPE", "").trim().split(" ");
                    const selector = parts[0];
                    const text = parts.slice(1).join(" ");
                    await page.fill(selector, text);
                } else if (decision.startsWith("WAIT")) {
                    const ms = parseInt(decision.replace("WAIT", "").trim());
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
            return { success: true, message: "Task completed after maximum steps." };
        } catch (error) {
            console.error("[BrowserAgent] Task failed:", error.message);
            await page.close();
            throw error;
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
        if (!socket) return;
        
        try {
            // Check for blocks every few frames
            if (Math.random() > 0.7) {
                this.checkBlock(userId, page, socket);
            }

            const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
            const base64 = screenshot.toString('base64');
            
            socket.emit("browser_frame", {
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
}

module.exports = new BrowserAgentService();
