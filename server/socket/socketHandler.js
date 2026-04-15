const browserAgentService = require("../services/browserAgentService");
let users = {}; // Map socket ID to user ID

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("New Socket Connection:", socket.id);

        socket.on("join-room", (userId) => {
            if (userId) {
                users[userId] = socket.id;
                console.log(`User mapped: ${userId} -> ${socket.id}`);

                // Allow user to join a room with their own ID for personal notifications
                socket.join(userId);
            }
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
