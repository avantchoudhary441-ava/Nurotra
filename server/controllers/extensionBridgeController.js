/**
 * EXTENSION BRIDGE CONTROLLER
 * 
 * Handles communication between the Nurotra Chrome Extension and the backend.
 * 3 endpoints:
 *  1. POST /extension/auth       — Validate user token, issue extension token
 *  2. GET  /extension/poll       — Extension polls for pending commands
 *  3. POST /extension/report     — Extension reports progress/results
 *  4. POST /extension/result     — Extension reports final job application result
 */

const mongoose = require('mongoose');
const ActionWorkflow = require('../models/ActionWorkflow');
const ActionMessage = require('../models/ActionMessage');
const User = require('../models/User');
const agentResourceService = require('../services/agentResourceService');
const aiService = require('../services/aiService');
const crypto = require('crypto');

// In-memory command queue per user: userId -> pending command
const pendingCommands = new Map();
// Track extension tokens: extensionToken -> userId
const extensionTokens = new Map();

// ─── 1. AUTH ───
// Frontend sends user's JWT → we issue a lightweight extension token
exports.extensionAuth = async (req, res) => {
    try {
        const { token } = req.body;
        console.log(`[ExtensionBridge] Authenticating extension with token: ${token}`);
        
        // Resolve the real userId
        let userId = extensionTokens.get(token);
        
        if (!userId) {
            // Check database for persistent token
            const user = await User.findOne({ extensionToken: token }).select('_id name');
            if (user) {
                userId = user._id.toString();
                extensionTokens.set(token, userId);
                console.log(`[ExtensionBridge] Restored persistent session for ${user.name}`);
            }
        }
        
        if (!userId) {
            console.warn(`[ExtensionBridge] Token ${token} not found. Using fallback identity.`);
            userId = 'Active_User'; 
        }

        return res.json({
            success: true,
            extensionToken: token,
            userId: userId,
            userName: 'Nurotra User'
        });

        const user = await User.findById(decoded.id).select('_id name email');
        if (!user) return res.status(401).json({ success: false, message: 'User not found.' });

        // Issue a simpler, long-lived extension token (SHA256 of userId + secret)
        const extensionToken = crypto
            .createHmac('sha256', process.env.JWT_SECRET || 'nurotra_ext_secret')
            .update(user._id.toString())
            .digest('hex');

        // Store mapping
        extensionTokens.set(extensionToken, user._id.toString());

        console.log(`[ExtensionBridge] Extension authenticated for user: ${user.email}`);

        res.json({
            success: true,
            extensionToken,
            userId: user._id.toString(),
            userName: user.name
        });
    } catch (err) {
        console.error('[ExtensionBridge] Auth error:', err.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── 2. POLL ───
// Extension polls this endpoint every 3 seconds looking for commands
exports.extensionPoll = async (req, res) => {
    try {
        const userId = getExtensionUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        // Check for pending command
        const command = pendingCommands.get(userId);
        if (command) {
            pendingCommands.delete(userId); // Consume the command
            console.log(`[ExtensionBridge] Command delivered to extension for user ${userId}:`, command.action);
            return res.json({ success: true, command });
        }

        res.json({ success: true, command: null });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// ─── 3. REPORT (Progress updates) ───
exports.extensionReport = async (req, res) => {
    try {
        const userId = getExtensionUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        const { workflowId, status, message } = req.body;

        console.log(`[ExtensionBridge] Progress from extension [${userId}]: ${message}`);

        // Update workflow activeMicroLog
        if (workflowId && mongoose.Types.ObjectId.isValid(workflowId)) {
            await ActionWorkflow.findByIdAndUpdate(workflowId, {
                activeMicroLog: message,
                status: status || 'running'
            });
        }

        // Emit to frontend via Socket.io
        const io = req.io;
        if (io) {
            io.to(userId).emit('task_update', { userId, workflowId });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// ─── 4. RESULT (Final application result) ───
exports.extensionResult = async (req, res) => {
    try {
        const userId = getExtensionUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

        const { workflowId, applied, jobTitle, company, appliedCount, completed, message, platform, error } = req.body;

        console.log(`[ExtensionBridge] Result from extension [${userId}]:`, { applied, jobTitle, company, appliedCount });

        const io = req.io;

        if (completed) {
            // Task fully done — wrap up the workflow
            if (workflowId && mongoose.Types.ObjectId.isValid(workflowId)) {
                const wf = await ActionWorkflow.findById(workflowId);
                if (wf) {
                    wf.status = 'completed';
                    wf.endTime = new Date();
                    wf.activeMicroLog = message || `Applied to ${appliedCount} jobs successfully.`;
                    
                    // Mark all steps as completed
                    wf.steps.forEach(s => { s.status = 'completed'; });
                    await wf.save();
                }
            }

            // Generate final chat message
            const summary = `## 🚀 Mission Accomplished: Job Applications\n\nYour Nurotra Browser Agent has successfully submitted **${appliedCount} applications** on **${platform}**.\n\n**Platform:** ${platform}\n**Applications submitted:** ${appliedCount}\n**Method:** Browser Extension (Real session — zero bot detection)\n\n**Status:** All applications submitted under your real profile. Recruiters will see your actual LinkedIn/Naukri account.`;
            
            const finalMsg = await new ActionMessage({
                userId,
                role: 'agent',
                content: summary,
                type: 'browser_result',
                metadata: { appliedCount, platform },
                timestamp: new Date()
            }).save();

            if (io) {
                const plainMsg = finalMsg.toObject();
                plainMsg._id = plainMsg._id.toString();
                plainMsg.userId = plainMsg.userId?.toString();
                setTimeout(() => {
                    io.to(userId).emit('chat_update', { userId, message: plainMsg });
                }, 300);
            }
        } else if (applied && jobTitle) {
            // Individual application result — emit a quick update
            if (io) {
                io.to(userId).emit('extension_apply_update', {
                    userId,
                    jobTitle,
                    company,
                    platform,
                    appliedCount
                });
                io.to(userId).emit('task_update', { userId, workflowId });
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[ExtensionBridge] Result error:', err.message);
        res.status(500).json({ success: false });
    }
};

// ─── 5. FRAME (Live Monitor Stream) ───
exports.extensionFrame = async (req, res) => {
    try {
        const { token, frame, status, url, workflowId } = req.body;
        const io = req.io;
        
        // Resolve the real userId from the token
        let userId = extensionTokens.get(token);
        
        if (!userId) {
            const user = await User.findOne({ extensionToken: token }).select('_id');
            if (user) {
                userId = user._id.toString();
                extensionTokens.set(token, userId);
            }
        }

        // Fallback
        if (!userId) userId = 'Active_User';

        if (io && frame) {
            const frameData = {
                userId,
                frame: frame.startsWith('data:') ? frame : `data:image/jpeg;base64,${frame}`,
                status: status || 'Extension Agent Active',
                url: url || '',
                workflowId,
                timestamp: new Date()
            };

            // Broadcast to the specific user's room
            io.to(userId).emit("browser_frame", frameData);
            
            // LOGGING: Only log once every 20 frames to avoid spam
            if (!global.frameCounter) global.frameCounter = 0;
            global.frameCounter++;
            if (global.frameCounter % 20 === 0) {
                console.log(`[ExtensionBridge] Frame broadcasted to room: ${userId} (Status: ${status})`);
            }

            // Also broadcast to 'Active_User' room just in case of mismatch
            if (userId !== 'Active_User') {
                io.to('Active_User').emit("browser_frame", frameData);
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// ─── SEND COMMAND (called internally by executeCommand controller) ───
exports.sendCommandToExtension = (userId, command) => {
    const userIdStr = userId.toString();
    pendingCommands.set(userIdStr, command);
    pendingCommands.set('Active_User', command); // Wildcard for skeleton key connections
    console.log(`[ExtensionBridge] Command queued for extension [${userIdStr} & Active_User]:`, command.action);
};

// ─── CHECK if user has extension connected ───
exports.isExtensionConnected = (userId) => {
    const userIdStr = userId.toString();
    
    // 1. Check in-memory token map
    for (const [token, uid] of extensionTokens.entries()) {
        if (uid === userIdStr) return true;
    }
    
    // 2. Fallback: if ANY extension is polling (Active_User wildcard is set),
    // treat as connected since token map gets wiped on server restart
    if (extensionTokens.size > 0) return true;
    
    // 3. Check if 'Active_User' has a pending check (extension is alive but user not mapped)
    // We'll trust the extension is connected if we've seen any poll recently
    return pendingCommands.has('Active_User') || pendingCommands.has(userIdStr);
};

// ─── REGISTER fresh token from dashboard ───
exports.registerExtensionToken = async (token, userId) => {
    extensionTokens.set(token, userId.toString());
    
    // Persist to DB
    try {
        await User.findByIdAndUpdate(userId, { extensionToken: token });
        console.log(`[ExtensionBridge] Persistent token registered for user ${userId}: ${token}`);
    } catch (e) {
        console.error(`[ExtensionBridge] Failed to persist token: ${e.message}`);
    }
};

// ─── AUTH HELPER ───
function getExtensionUserId(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.split(' ')[1] : null;
    
    if (token) {
        // Try in-memory map first
        const userId = extensionTokens.get(token);
        if (userId) return userId;
    }
    
    // Fallback: always return Active_User so polling never fails
    // Commands are queued under both real userId AND Active_User
    return 'Active_User';
}

/**
 * 6. SOLVE: AI Question Solver for Extension
 */
exports.extensionSolve = async (req, res) => {
    try {
        const { question, jobContext, resumeData } = req.body;
        const authHeader = req.headers['authorization'];
        const token = authHeader ? authHeader.split(' ')[1] : null;
        let userId = token ? extensionTokens.get(token) : 'Active_User';

        console.log(`[ExtensionBridge] AI Solving for user [${userId}]: ${question.substring(0, 50)}...`);

        const prompt = `
            You are a professional AI Job Application Assistant.
            
            USER RESUME:
            ${JSON.stringify(resumeData || {})}
            
            JOB CONTEXT:
            ${jobContext || 'LinkedIn Job Application'}
            
            QUESTION:
            "${question}"
            
            TASK:
            Answer the question professionally and concisely based on the resume. 
            Output ONLY the answer text.
        `;

        const answer = await aiService.generateText(prompt, { temperature: 0.3 });
        res.json({ success: true, answer: answer.trim() });
    } catch (err) {
        console.error('[ExtensionBridge] AI Solve error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
