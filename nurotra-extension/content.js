/**
 * NUROTRA JOB AGENT - CONTENT SCRIPT
 */

console.log('%c🚀 NUROTRA AGENT ACTIVE', 'background: #7c3aed; color: #fff; padding: 5px; border-radius: 3px; font-weight: bold;');

let agentConfig = null;
let isRunning = false;
let appliedCount = 0;
let overlay = null;

// ─── LISTEN FOR COMMANDS ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_APPLY') {
        agentConfig = message;
        if (!isRunning) {
            isRunning = true;
            setTimeout(() => startJobApplication(), 1000);
        }
        sendResponse({ success: true });
    }
    if (message.type === 'STOP') {
        isRunning = false;
        removeOverlay();
        sendResponse({ success: true });
    }
    return true;
});

// ─── MAIN ENTRY POINT ───
async function startJobApplication() {
    const host = window.location.hostname;
    const platform = host.includes('linkedin.com') ? 'linkedin' :
                     host.includes('naukri.com') ? 'naukri' :
                     host.includes('indeed.com') ? 'indeed' : 'generic';

    console.log(`[Nurotra] Starting ${platform} automation...`);
    updateOverlay(`🤖 Nurotra Agent Engaged (${platform})`);
    
    try {
        if (platform === 'linkedin') {
            console.log('[Nurotra] Calling runLinkedInApply...');
            await runLinkedInApply();
        }
        else if (platform === 'naukri') await runNaukriApply();
        else if (platform === 'indeed') await runIndeedApply();
        else await runGenericApply();
    } catch (err) {
        console.error('[Nurotra] Application error:', err);
        reportBack({ applied: false, error: err.message, platform });
    }
}

// ─────────────────────────────────────────────
// PRO-LEVEL INTERACTION ENGINE (Shadow-Piercing)
// ─────────────────────────────────────────────

/**
 * SHADOW PIERCER: Finds elements even if they are inside nested Shadow Roots.
 */
function queryShadow(selector, root = document) {
    const el = root.querySelector(selector);
    if (el) return el;
    const hosts = root.querySelectorAll('*');
    for (const host of hosts) {
        if (host.shadowRoot) {
            const found = queryShadow(selector, host.shadowRoot);
            if (found) return found;
        }
    }
    return null;
}

function queryShadowAll(selector, root = document, results = []) {
    const elements = root.querySelectorAll(selector);
    elements.forEach(el => results.push(el));
    const hosts = root.querySelectorAll('*');
    for (const host of hosts) {
        if (host.shadowRoot) {
            queryShadowAll(selector, host.shadowRoot, results);
        }
    }
    return results;
}

async function smartFill(element, value) {
    if (!element) return;
    element.focus();
    if (element.tagName === 'SELECT') {
        const options = Array.from(element.options);
        const match = options.find(o => o.text.toLowerCase().includes(value.toLowerCase()) || o.value.toLowerCase().includes(value.toLowerCase()));
        if (match) element.value = match.value;
        else if (options.length > 1) element.selectedIndex = 1;
    } else if (element.type === 'checkbox' || element.type === 'radio') {
        if (value === true || value === 'yes' || value === 'Yes') element.checked = true;
    } else {
        element.value = value;
    }
    const events = ['keydown', 'keypress', 'input', 'change', 'keyup', 'blur'];
    events.forEach(type => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
    });
    await sleep(250);
}

function findField(labelText) {
    const query = labelText.toLowerCase();
    
    // 1. Search by Label Text (Shadow-Aware)
    const labels = queryShadowAll('label');
    for (const label of labels) {
        if (label.innerText.toLowerCase().includes(query)) {
            const inputId = label.getAttribute('for');
            if (inputId) return queryShadow(`#${inputId}`);
            return label.querySelector('input, select, textarea');
        }
    }

    // 2. Search by Placeholder/Aria (Shadow-Aware)
    const inputs = queryShadowAll('input, select, textarea, [role="textbox"]');
    return inputs.find(i => 
        (i.placeholder && i.placeholder.toLowerCase().includes(query)) ||
        (i.getAttribute('aria-label') && i.getAttribute('aria-label').toLowerCase().includes(query)) ||
        (i.name && i.name.toLowerCase().includes(query))
    );
}

// ─────────────────────────────────────────────
// LINKEDIN STRATEGY (Batch Mode)
// ─────────────────────────────────────────────
async function runLinkedInApply() {
    createOverlay();
    updateOverlay('🚀 Initializing Pro-Agent...');
    
    const selectors = [
        '.job-card-container',
        '.jobs-search-results__list-item',
        'li[data-occludable-job-id]',
        '.scaffold-layout__list-item',
        '[data-job-id]',
        '.jobs-search-results-list__list-item',
        'li.ember-view'
    ];

    // Poll up to 20 seconds for LinkedIn SPA to render job cards
    let jobCards = [];
    for (let attempt = 0; attempt < 10; attempt++) {
        jobCards = Array.from(document.querySelectorAll(selectors.join(', ')));

        // DEBUG on first attempt — log actual page state
        if (attempt === 0) {
            console.log(`[Nurotra DEBUG] URL: ${window.location.href}`);
            console.log(`[Nurotra DEBUG] Title: ${document.title}`);
            const allLi = document.querySelectorAll('li');
            console.log(`[Nurotra DEBUG] Total <li>: ${allLi.length}`);
            if (allLi[0]) console.log(`[Nurotra DEBUG] li[0] class: "${allLi[0].className}"`);
            if (allLi[1]) console.log(`[Nurotra DEBUG] li[1] class: "${allLi[1].className}"`);
            if (allLi[2]) console.log(`[Nurotra DEBUG] li[2] class: "${allLi[2].className}"`);
        }

        if (jobCards.length > 0) break;
        updateOverlay(`⏳ Waiting for jobs... (${attempt + 1}/10)`);
        await sleep(2000);
    }

    if (jobCards.length === 0) {
        console.log('[Nurotra DEBUG] Gave up. Final URL:', window.location.href);
        reportBack({ applied: false, error: 'No jobs found after 20s.', platform: 'linkedin' });
        return;
    }


    updateOverlay(`🎯 Found ${jobCards.length} jobs. Starting Batch...`);
    appliedCount = 0;

    for (let i = 0; i < Math.min(jobCards.length, 15) && isRunning; i++) {
        try {
            const card = jobCards[i];
            if (!card) continue;

            const cardText = card.innerText.toLowerCase();
            if (cardText.includes('applied') || cardText.includes('viewed')) {
                console.log(`[Nurotra] Skipping card ${i+1}: Already applied/viewed.`);
                continue;
            }
            
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(1000);
            
            // Robust click simulation
            const simulateClick = (el) => {
                const events = ['mousedown', 'mouseup', 'click'];
                events.forEach(type => {
                    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
                });
            };

            simulateClick(card);
            await sleep(2000);

            const jobTitle = card.innerText.split('\n')[0].substring(0, 30);
            
            // More aggressive search for Apply button
            const applyBtn = document.querySelector('button[aria-label*="Easy Apply"], .jobs-apply-button button, .jobs-s-apply button');
            
            if (applyBtn && (applyBtn.innerText.includes('Easy Apply') || applyBtn.getAttribute('aria-label')?.includes('Easy Apply'))) {
                updateOverlay(`📝 [${appliedCount+1}] Processing: ${jobTitle}...`);
                console.log(`[Nurotra] Clicking Easy Apply for: ${jobTitle}`);
                
                simulateClick(applyBtn);
                await sleep(3000); // Give modal time to pop

                // Verify modal is open
                const modal = document.querySelector('.artdeco-modal, [role="dialog"]');
                if (!modal) {
                    console.warn('[Nurotra] Modal did not appear. Attempting re-click...');
                    simulateClick(applyBtn);
                    await sleep(2000);
                }

                const success = await handleEasyApplyModal();
                if (success) {
                    appliedCount++;
                    console.log(`%c[Nurotra] SUCCESS: ${jobTitle}`, 'color: #10b981; font-weight: bold;');
                }
                
                // Close modal cleanup
                const closeBtn = document.querySelector('button[aria-label="Dismiss"], .artdeco-modal__dismiss');
                if (closeBtn) {
                    simulateClick(closeBtn);
                    await sleep(1000);
                    const discard = document.querySelector('[data-control-name="discard_application_confirm_btn"], .artdeco-modal__confirm-dialog-btn--primary');
                    if (discard) simulateClick(discard);
                }
            } else {
                console.log(`[Nurotra] Skipping ${jobTitle} - Not an 'Easy Apply' job.`);
            }
        } catch (e) { console.error('[Nurotra] Job skip:', e.message); }
        await sleep(1500);
    }

    reportBack({ 
        applied: appliedCount > 0, 
        completed: true,
        message: `Finished! Applied to ${appliedCount} jobs.`,
        platform: 'linkedin' 
    });
    updateOverlay(`✅ Batch Complete! (${appliedCount} Applied)`);
    setTimeout(removeOverlay, 5000);
}

async function handleEasyApplyModal() {
    let steps = 0;
    const maxSteps = 15;
    
    while (steps < maxSteps && isRunning) {
        steps++;
        await fillLinkedInFields();
        await sleep(1000);

        // A. Check if application was SUBMITTED successfully
        const successSelectors = [
            '.artdeco-inline-feedback--success',
            '.jp-success-icon',
            '.artdeco-modal__header:contains("Application submitted")',
            '.artdeco-modal__header h2:contains("Application submitted")'
        ];
        const isSuccess = Array.from(document.querySelectorAll('h2, h3, span, div')).some(el => 
            el.innerText.toLowerCase().includes('application submitted') || 
            el.innerText.toLowerCase().includes('success')
        );

        if (isSuccess) {
            updateOverlay('🎉 Application Submitted!');
            await sleep(2000);
            return true;
        }

        // B. Find navigation buttons (Shadow-Aware)
        const modal = queryShadow('.artdeco-modal, [role="dialog"]');
        if (!modal) break;

        const nextBtn = queryShadow('button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Submit"], .artdeco-button--primary', modal);
        
        if (!nextBtn) {
            console.log('[Nurotra] No navigation button found. Checking for hidden Submit...');
            const allBtns = queryShadowAll('button', modal);
            const finalBtn = allBtns.find(b => b.innerText.includes('Submit') || b.innerText.includes('Review'));
            if (finalBtn) {
                simulateClick(finalBtn);
                await sleep(3000);
                continue;
            }
            break;
        }

        const btnText = nextBtn.innerText.toLowerCase();
        if (btnText.includes('submit')) {
            updateOverlay('📤 Final Submission...');
            simulateClick(nextBtn);
            await sleep(4000);
            // Re-check for success in next iteration
            continue;
        }

        updateOverlay(`➡️ Moving to Step ${steps}...`);
        simulateClick(nextBtn);
        await sleep(2500);

        // C. Check for errors
        const error = document.querySelector('.artdeco-inline-feedback--error, [data-test-form-element-error-messages]');
        if (error) {
            console.warn('[Nurotra] Field error detected:', error.innerText);
            updateOverlay('⚠️ Field Error. Trying to bypass...');
            // Try one more time or break
        }
    }
    return false;
}

function simulateClick(el) {
    if (!el) return;
    const events = ['mousedown', 'mouseup', 'click'];
    events.forEach(type => {
        el.dispatchEvent(new MouseEvent(type, { 
            bubbles: true, 
            cancelable: true, 
            view: window,
            buttons: 1 
        }));
    });
}

async function fillLinkedInFields() {
    const profile = agentConfig.userProfile || {};
    const jobTitle = document.querySelector('.jobs-unified-top-card__job-title')?.innerText || '';
    const jobDescription = document.querySelector('.jobs-description')?.innerText?.substring(0, 500) || '';
    const context = `Job Title: ${jobTitle}. Brief: ${jobDescription}`;

    // 1. Process all inputs (Shadow-Aware)
    const inputs = queryShadowAll('input, select, textarea');
    
    for (const input of inputs) {
        if (input.value && input.value !== '0' && input.type !== 'radio' && input.type !== 'checkbox') continue;

        // Identify the question
        const label = input.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping')?.querySelector('label')?.innerText || 
                      input.placeholder || 
                      input.getAttribute('aria-label') || '';
        
        if (!label && input.type !== 'radio' && input.type !== 'checkbox') continue;

        // A. Handle simple/known fields first (Faster)
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('phone')) { await smartFill(input, profile.phone || '1234567890'); continue; }
        if (lowerLabel.includes('email')) { await smartFill(input, profile.email || ''); continue; }
        if (lowerLabel.includes('city') || lowerLabel.includes('location')) { await smartFill(input, profile.city || 'New York'); continue; }
        
        // B. Handle Radio Buttons (Yes/No questions)
        if (input.type === 'radio') {
            const radioLabel = input.nextElementSibling?.innerText || '';
            if (radioLabel.toLowerCase().includes('yes') || radioLabel.toLowerCase().includes('authorized')) {
                input.click();
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            continue;
        }

        // C. AI Solving for unknown/complex questions
        updateOverlay(`🧠 AI Thinking: ${label.substring(0, 20)}...`);
        const response = await chrome.runtime.sendMessage({
            type: 'SOLVE_QUESTION',
            question: label,
            jobContext: context,
            resumeData: profile
        });

        if (response && response.answer) {
            await smartFill(input, response.answer);
        }
    }

    // D. Handle Resume Selection
    const resumeText = document.body.innerText.toLowerCase();
    if (resumeText.includes('choose a resume') || resumeText.includes('select a resume')) {
        const resumeBtn = queryShadow('button[aria-label*="resume"], .jobs-document-card__row button');
        if (resumeBtn) {
            console.log('[Nurotra] Selecting existing resume...');
            simulateClick(resumeBtn);
        }
    }

    // E. Final check for Select boxes
    const selects = queryShadowAll('select');
    selects.forEach(s => {
        if (!s.value && s.options.length > 1) {
            s.selectedIndex = 1;
            s.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// ─── HELPERS ───
function reportBack(data) {
    chrome.runtime.sendMessage({ type: 'JOB_RESULT', result: data });
}

function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'nurotra-overlay';
    overlay.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999999;
        background: #7c3aed; color: white; padding: 15px 25px;
        border-radius: 12px; font-family: sans-serif; font-weight: bold;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 15px;
        pointer-events: none;
    `;
    overlay.innerHTML = `<div style="width:12px; height:12px; background:#4ade80; border-radius:50%; animation: pulse 1s infinite;"></div><span id="nuro-text">Initializing...</span>`;
    document.body.appendChild(overlay);
    
    const style = document.createElement('style');
    style.textContent = `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`;
    document.head.appendChild(style);
}

function updateOverlay(text) {
    createOverlay();
    const span = document.getElementById('nuro-text');
    if (span) span.innerText = text;
}

function removeOverlay() {
    if (overlay) overlay.remove();
    overlay = null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitFor(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
            if (document.querySelector(selector)) { clearInterval(interval); resolve(); }
            else if (Date.now() - start > timeout) { clearInterval(interval); reject(); }
        }, 500);
    });
}

// ─── OTHER PLATFORMS (PLACEHOLDERS) ───
async function runNaukriApply() { updateOverlay('Naukri not yet implemented in Batch Mode'); }
async function runIndeedApply() { updateOverlay('Indeed not yet implemented in Batch Mode'); }
async function runGenericApply() { updateOverlay('Platform not supported'); }
