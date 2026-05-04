/**
 * NUROTRA JOB AGENT - BACKGROUND SERVICE WORKER
 * 
 * This is the brain of the extension. It:
 * 1. Connects to the Nurotra backend via long-polling (since MV3 doesn't support persistent WebSocket)
 * 2. Receives job application commands from the backend
 * 3. Injects content scripts into job site tabs to execute applications
 * 4. Reports results back to the Nurotra backend
 */

const BACKEND_URL = 'http://localhost:5000';
const POLL_INTERVAL_MS = 3000;

let authToken = null;
let userId = null;
let isPolling = false;
let currentJob = null;

// ─── INIT: Load saved auth on startup ───
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Nurotra] Extension installed/updated.');
    loadAuth();
});

chrome.runtime.onStartup.addListener(() => {
    loadAuth();
});

// ─── MESSAGES from popup or content scripts ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_AUTH') {
        authToken = message.token;
        userId = message.userId;
        chrome.storage.local.set({ authToken, userId });
        startPolling();
        sendResponse({ success: true });
    }

    if (message.type === 'AUTO_SYNC') {
        autoAuth(message.token, message.userId).then(success => {
            sendResponse({ success });
        });
    }

    if (message.type === 'GET_STATUS') {
        sendResponse({ 
            connected: isPolling, 
            userId,
            currentJob: currentJob?.title || null
        });
    }

    if (message.type === 'DISCONNECT') {
        stopPolling();
        authToken = null;
        userId = null;
        chrome.storage.local.remove(['authToken', 'userId']);
        sendResponse({ success: true });
    }

    if (message.type === 'JOB_RESULT') {
        // Content script reporting back a result
        reportResult(message.result);
        sendResponse({ success: true });
    }

    if (message.type === 'SOLVE_QUESTION') {
        // Content script needs help with a complex question
        solveQuestion(message.question, message.jobContext, message.resumeData)
            .then(answer => sendResponse({ answer }))
            .catch(err => sendResponse({ error: err.message }));
        return true; // Async response
    }

    return true; // Keep message channel open for async
});

// ─── AUTH PERSISTENCE ───
async function loadAuth() {
    const data = await chrome.storage.local.get(['authToken', 'userId']);
    if (data.authToken && data.userId) {
        authToken = data.authToken;
        userId = data.userId;
        console.log(`[Nurotra] Restored session for user ${userId}`);
        startPolling();
    }
}

async function autoAuth(jwt, uId) {
    if (isPolling && userId === uId) return true; // Already connected

    try {
        const response = await fetch(`${BACKEND_URL}/api/action-agent/extension/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: jwt })
        });

        const data = await response.json();
        if (data.success) {
            // Wait up to 20 seconds for LinkedIn SPA to render job cards
            const selectors = [
                '.job-card-container',
                '.jobs-search-results__list-item', 
                'li[data-occludable-job-id]',
                '.scaffold-layout__list-item',
                '[data-job-id]'
            ];
            
            let jobCards = [];
            for (let attempt = 0; attempt < 10; attempt++) {
                jobCards = Array.from(document.querySelectorAll(selectors.join(', ')));
                if (jobCards.length > 0) break;
                updateOverlay(`⏳ Waiting for jobs to load... (${attempt + 1}/10)`);
                await sleep(2000);
            }

            if (jobCards.length === 0) {
                reportBack({ applied: false, error: 'No jobs found after 20s wait.', platform: 'linkedin' });
                return;
            }
            authToken = data.extensionToken;
            userId = data.userId;
            chrome.storage.local.set({ authToken, userId });
            startPolling();
            console.log('[Nurotra] Zero-Touch Sync completed.');
            return true;
        }
    } catch (err) {
        console.error('[Nurotra] Auto-auth failed:', err.message);
    }
    return false;
}

// ─── POLLING: Check for commands from Nurotra backend ───
let pollTimer = null;

function startPolling() {
    if (isPolling || !authToken) return;
    isPolling = true;
    console.log('[Nurotra] Starting command polling...');
    poll();
}

function stopPolling() {
    isPolling = false;
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
    console.log('[Nurotra] Polling stopped.');
}

async function poll() {
    if (!isPolling || !authToken) {
        console.log('[Nurotra] Polling skipped: Not active or no token.');
        return;
    }

    try {
        console.log('[Nurotra] Polling Nurotra backend for commands...');
        const response = await fetch(`${BACKEND_URL}/api/action-agent/extension/poll`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            console.warn('[Nurotra] Token expired. Disconnecting.');
            stopPolling();
            authToken = null;
            chrome.storage.local.remove(['authToken', 'userId']);
            return;
        }

        if (response.ok) {
            const data = await response.json();
            console.log('[Nurotra] Poll response:', data);
            
            if (data.command) {
                console.log('[Nurotra] !!! COMMAND RECEIVED !!!', data.command);
                await handleCommand(data.command);
            }
        }
    } catch (err) {
        console.log('[Nurotra] Backend poll failed (Offline?):', err.message);
    }

    // Schedule next poll
    if (isPolling) {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }
}

// ─── COMMAND HANDLER ───
async function handleCommand(command) {
    const { action, platform, keywords, location, workflowId, resumeData, userProfile } = command;

    if (action === 'apply_jobs') {
        console.log('[Nurotra] Starting apply_jobs sequence...', { keywords, platform, workflowId });
        currentJob = { title: `Applying: ${keywords} on ${platform}`, workflowId };
        
        // Start live monitor stream
        startScreenshotHeartbeat(workflowId);
        
        // Notify user (fix: add required notificationId)
        chrome.notifications.create('nurotra-agent-active', {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Nurotra Agent Active',
            message: `Starting job search on ${platform}`
        }, () => { if (chrome.runtime.lastError) {} });

        // Clean keywords: strip natural language phrases and leading articles
        const cleanKeywords = keywords
            .replace(/apply (to |for )?/gi, '')
            .replace(/job(s)? on \w+/gi, '')
            .replace(/on (linkedin|naukri|indeed|internshala)/gi, '')
            .replace(/in \w+/gi, '')
            .replace(/^(a|an|the)\s+/i, '')
            .trim() || keywords;
        
        // Determine target URL for job search
        const targetUrl = buildSearchUrl(platform, cleanKeywords, location);
        console.log('[Nurotra] Generated search URL:', targetUrl);
        
        // Open tab and inject content script
        console.log('[Nurotra] Creating new tab...');
        const tab = await chrome.tabs.create({ url: targetUrl, active: true });
        console.log('[Nurotra] Tab created with ID:', tab.id);
        
        // Wait for tab to fully load then inject the agent with retries
        let retryCount = 0;
        const maxRetries = 10;
        
        const trySendMessage = (tabId) => {
            if (retryCount >= maxRetries) {
                console.error('[Nurotra] Failed to reach content script after maximum retries.');
                reportStatus(workflowId, 'failed', 'Browser extension could not connect to the job site. Please refresh and try again.');
                return;
            }

            console.log(`[Nurotra] Attempting to wake up content script (Attempt ${retryCount + 1})...`);
            chrome.tabs.sendMessage(tabId, {
                type: 'EXECUTE_APPLY',
                keywords: cleanKeywords,
                location,
                platform,
                workflowId,
                resumeData,
                userProfile
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('[Nurotra] Content script not ready, trying scripting injection...');
                    // FALLBACK: Force-inject content.js if sendMessage failed
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content.js']
                    }).then(() => {
                        console.log('[Nurotra] Force-injected content.js, retrying message...');
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, {
                                type: 'EXECUTE_APPLY',
                                keywords: cleanKeywords,
                                location,
                                platform,
                                workflowId,
                                resumeData,
                                userProfile
                            }, (r) => {
                                if (!chrome.runtime.lastError) {
                                    console.log('[Nurotra] Content script ACKNOWLEDGED after force-inject!');
                                } else {
                                    retryCount++;
                                    setTimeout(() => trySendMessage(tabId), 1500);
                                }
                            });
                        }, 1000);
                    }).catch(() => {
                        retryCount++;
                        setTimeout(() => trySendMessage(tabId), 1500);
                    });
                } else {
                    console.log('[Nurotra] Content script ACKNOWLEDGED command. Handshake complete.');
                }
            });
        };

        chrome.tabs.onUpdated.addListener(function tabListener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                console.log('[Nurotra] Tab status complete. Initiating handshake...');
                chrome.tabs.onUpdated.removeListener(tabListener);
                // Give it a small head start to let document_idle scripts run
                setTimeout(() => trySendMessage(tab.id), 1000);
            }
        });

        // Heartbeat: report agent is working
        await reportStatus(workflowId, 'running', `Opened ${platform} — searching for "${keywords}"`);
    }

    if (action === 'stop') {
        currentJob = null;
        console.log('[Nurotra] Stop command received.');
    }
}

// ─── URL BUILDERS ───
function buildSearchUrl(platform, keywords, location) {
    const q = encodeURIComponent(keywords || '');
    const loc = encodeURIComponent((location || 'India').trim());

    switch (platform.toLowerCase()) {
        case 'linkedin':
            return `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}&f_AL=true&sortBy=DD`;
        case 'naukri':
            return `https://www.naukri.com/${keywords.toLowerCase().replace(/\s+/g, '-')}-jobs`;
        case 'indeed':
            return `https://in.indeed.com/jobs?q=${q}&l=${loc}`;
        case 'internshala':
            return `https://internshala.com/internships/${keywords.toLowerCase().replace(/\s+/g, '-')}-internship`;
        case 'glassdoor':
            return `https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=${q}`;
        default:
            return `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}&f_AL=true`;
    }
}

// ─── REPORTING ───
// ─── LIVE MONITOR SCREENSHOTS ───
let screenshotInterval = null;

function startScreenshotHeartbeat(workflowId) {
    if (screenshotInterval) return;
    
    console.log('[Nurotra] Starting Live Monitor stream...');
    screenshotInterval = setInterval(async () => {
        try {
            // Get the current active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            
            if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) return;

            const token = await getStoredToken();
            if (!token) return;

            // Capture the visible area of the active tab
            chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 30 }, async (dataUrl) => {
                if (chrome.runtime.lastError || !dataUrl) return;

                // Send frame to backend for the Live Monitor
                fetch(`${BACKEND_URL}/api/action-agent/extension/frame`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: token,
                        frame: dataUrl,
                        status: 'Nurotra Agent: Executing...',
                        url: tab.url,
                        workflowId
                    })
                }).catch(() => {});
            });
        } catch (e) {
            console.warn('[Nurotra] Screenshot heartbeat failed:', e.message);
        }
    }, 1500); // 1.5s for smoother live monitoring
}

/**
 * HELPER: Retrieve the stored authentication token safely
 */
async function getStoredToken() {
    try {
        const data = await chrome.storage.local.get(['authToken']);
        return data.authToken || authToken;
    } catch (e) {
        return authToken;
    }
}

function stopScreenshotHeartbeat() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
        console.log('[Nurotra] Live Monitor stream stopped.');
    }
}

async function reportStatus(workflowId, status, message) {
    if (status === 'completed' || status === 'failed') {
        stopScreenshotHeartbeat();
    }
    
    if (!authToken || !workflowId) return;
    
    try {
        await fetch(`${BACKEND_URL}/api/action-agent/extension/report`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ workflowId, status, message, timestamp: new Date().toISOString() })
        });
    } catch (err) {
        console.error('[Nurotra] Failed to report status:', err.message);
    }
}

async function reportResult(result) {
    if (!authToken) return;
    
    try {
        console.log('[Nurotra] Reporting result:', result);
        await fetch(`${BACKEND_URL}/api/action-agent/extension/result`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result)
        });

        if (result.applied) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: '✅ Application Submitted!',
                message: result.message || `Applied successfully.`
            });
        }
        
        // Only clear currentJob if it's a FINAL report or an error
        if (result.completed || result.error) {
            console.log('[Nurotra] Final report received. Mission concluded.');
            currentJob = null;
        }
    } catch (err) {
        console.error('[Nurotra] Failed to report result:', err.message);
    }
}

/**
 * AI SOLVER: Call backend to answer a complex question
 */
async function solveQuestion(question, jobContext, resumeData) {
    try {
        const token = await getStoredToken();
        const response = await fetch(`${BACKEND_URL}/api/action-agent/extension/solve`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ question, jobContext, resumeData })
        });
        const data = await response.json();
        return data.answer || '';
    } catch (err) {
        console.error('[Nurotra] solveQuestion error:', err.message);
        return '';
    }
}
