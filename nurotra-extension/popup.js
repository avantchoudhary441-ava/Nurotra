/**
 * NUROTRA EXTENSION POPUP SCRIPT
 * Handles user interaction — connect, disconnect, status display
 */

const BACKEND_URL = 'http://localhost:5000';

const connectSection = document.getElementById('connect-section');
const disconnectSection = document.getElementById('disconnect-section');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const tokenInput = document.getElementById('token-input');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const userIdDisplay = document.getElementById('user-id-display');
const agentStatus = document.getElementById('agent-status');
const appliedCount = document.getElementById('applied-count');
const currentJobBox = document.getElementById('current-job-box');
const currentJobName = document.getElementById('current-job-name');

// ─── LOAD STATE ───
document.addEventListener('DOMContentLoaded', async () => {
    const status = await getExtensionStatus();
    
    if (status.connected) {
        showConnected(status);
    } else {
        showDisconnected();
    }
});

// ─── CONNECT ───
connectBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
        alert('Please enter your Nurotra token.');
        return;
    }

    connectBtn.textContent = '⏳ Connecting...';
    connectBtn.disabled = true;

    try {
        // Just send the token to the backend and let the server decide
        const response = await fetch(`${BACKEND_URL}/api/action-agent/extension/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (data.success) {
            await chrome.runtime.sendMessage({
                type: 'SET_AUTH',
                token: data.extensionToken,
                userId: data.userId
            });
            showConnected({ userId: data.userId, currentJob: null });
        } else {
            alert('Connection failed. Please refresh your Nurotra Dashboard and try a new token.');
        }
    } catch (err) {
        alert('Cannot reach Nurotra backend. Make sure it\'s running on port 5000.');
    } finally {
        connectBtn.textContent = '🔗 Connect';
        connectBtn.disabled = false;
    }
});

// ─── DISCONNECT ───
disconnectBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
    showDisconnected();
});

// ─── STATUS POLLING ───
async function getExtensionStatus() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
            resolve(response || { connected: false });
        });
    });
}

// Update UI every 3 seconds
setInterval(async () => {
    const status = await getExtensionStatus();
    if (status.connected) {
        agentStatus.textContent = status.currentJob ? '⚡ Working...' : 'Waiting for commands';
        
        if (status.currentJob) {
            currentJobBox.style.display = 'block';
            currentJobName.textContent = status.currentJob;
        } else {
            currentJobBox.style.display = 'none';
        }
    }
}, 3000);

// ─── UI HELPERS ───
function showConnected(status) {
    connectSection.style.display = 'none';
    disconnectSection.style.display = 'block';
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected to Nurotra ✓';
    userIdDisplay.textContent = `...${status.userId?.toString().slice(-6) || '—'}`;

    if (status.currentJob) {
        currentJobBox.style.display = 'block';
        currentJobName.textContent = status.currentJob;
    }
}

function showDisconnected() {
    connectSection.style.display = 'block';
    disconnectSection.style.display = 'none';
    statusDot.classList.remove('connected');
    statusText.textContent = 'Not connected to Nurotra';
    tokenInput.value = '';
}
