const browserAgentService = require("../services/browserAgentService");
let users = {}; // Map socket ID to user ID
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = (io) => {
    // Authentication Middleware for Socket.io
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Authentication error: No token provided"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select("-password");
            
            if (!user) return next(new Error("Authentication error: User not found"));
            
            socket.user = user;
            next();
        } catch (err) {
            console.error("[Socket Auth] Error:", err.message);
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.user._id.toString();
        console.log(`Authenticated Socket [${socket.id}] for User [${userId}]`);

        // Automatically join user-specific room for notifications
        socket.join(userId);
        
        // Also join a generic 'sync_activity' room for this specific user
        socket.join(`sync_${userId}`);

        socket.on("join-room", (roomData) => {
            // Deprecated: Auto-joined room now, but keeping for compatibility
            console.log(`Socket ${socket.id} joining additional room`);
        });

        // --- Test Handler (For Visibility Verification) ---
        socket.on("test_sync", (data) => {
            console.log(`[Socket] Received test sync from user ${userId}`);
            io.to(userId).emit("sync_activity", {
                ...data,
                timestamp: new Date(),
                latencyMs: 120,
                id: Math.random().toString(36).substr(2, 9)
            });
        });

        // --- Call Signaling ---

        // Caller initiates call
        socket.on("call-user", (data) => {
            const { userToCall, signalData, from, name, picture } = data;
            // 'userToCall' is the target userId
            // Emit to the specific user room
            io.to(userToCall).emit("call-user", {
                signal: signalData,
                from,
                name,
                picture
            });
            console.log(`Call signal sent from ${from} to ${userToCall}`);
        });

        // Callee answers call
        socket.on("answer-call", (data) => {
            const { to, signal } = data; // 'to' is the caller's userId (mapped to socket id earlier, but better to emit to room)
            io.to(to).emit("call-accepted", signal);
            console.log(`Call accepted by ${to}`);
        });

        // ICE Candidates (for connectivity)
        socket.on("ice-candidate", (data) => {
            const { to, candidate } = data;
            io.to(to).emit("ice-candidate", { candidate });
        });

        // End Call
        socket.on("end-call", (data) => {
            const { to } = data;
            io.to(to).emit("call-ended");
            console.log(`Call ended for ${to}`);
        });

        // --- Action Agent Browser Remote Control ---
        socket.on("browser_input", async (data) => {
            const { userId, type, x, y, key, text } = data;
            if (userId) {
                await browserAgentService.handleRemoteInput(userId, data);
            }
        });

        socket.on("disconnect", () => {
            // Optional: remove user from map
            const userId = Object.keys(users).find(key => users[key] === socket.id);
            if (userId) {
                delete users[userId];
                console.log(`User ${userId} disconnected`);
            }
        });
    });
};
