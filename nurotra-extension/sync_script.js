/**
 * NUROTRA ZERO-TOUCH SYNC SCRIPT
 * 
 * This script runs only on Nurotra domains (localhost:5173, nurotra.online).
 * It automatically detects if the user is logged in and sends the auth token
 * to the background script, eliminating the need for manual copy-pasting.
 */

console.log('[Nurotra Sync] Monitoring for active session...');

function attemptSync() {
    try {
        // Guard: check if extension context is still valid
        if (!chrome.runtime?.id) return;

        const userData = localStorage.getItem('nurotra_user');
        if (!userData) return;

        const user = JSON.parse(userData);
        if (user.token && user._id) {
            try {
                chrome.runtime.sendMessage({
                    type: 'AUTO_SYNC',
                    token: user.token,
                    userId: user._id
                }, (response) => {
                    if (chrome.runtime.lastError) return; // ignore
                    if (response && response.success) {
                        console.log('[Nurotra Sync] Extension linked successfully.');
                    }
                });
            } catch (e) {
                // Extension was reloaded — stop the interval
                clearInterval(syncInterval);
            }
        }

    } catch (err) {
        // "Extension context invalidated" happens on reload — safe to ignore
        if (err.message && err.message.includes('Extension context invalidated')) return;
        console.error('[Nurotra Sync] Error:', err.message);
    }
}

// Run immediately and also listen for storage changes (login/logout)
attemptSync();

// Poll occasionally — stop if context dies
const syncInterval = setInterval(() => {
    if (!chrome.runtime?.id) {
        clearInterval(syncInterval);
        return;
    }
    attemptSync();
}, 5000);

