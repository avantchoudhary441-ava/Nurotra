const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const mongoose = require("mongoose");

const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Production CORS Configuration
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "https://nurotra.online",
    "https://www.nurotra.online",
    "https://nurotra.vercel.app"
];

if (process.env.CLIENT_URL) {
    process.env.CLIENT_URL.split(',').forEach(url => allowedOrigins.push(url.trim()));
}
if (process.env.VERCEL_URL) {
    allowedOrigins.push(process.env.VERCEL_URL);
}

const finalOrigins = [...new Set(allowedOrigins.filter(Boolean))];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (finalOrigins.indexOf(origin) !== -1 || finalOrigins.some(o => origin && origin.startsWith(o))) {
            callback(null, true);
        } else {
            console.warn(`Blocked CORS request from: ${origin}. Allowed: ${finalOrigins.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-socket-id'],
    exposedHeaders: ['Content-Disposition']
}));

// REQUEST MONITOR (Debug)
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString().split('T')[1].split('.')[0]} | ${req.method} ${req.url} | From: ${req.headers.origin || 'Unknown'}`);
    next();
});

const passport = require("./config/passport");
app.use(passport.initialize());

// GLOBAL CRASH PREVENTION
process.on('uncaughtException', (err) => {
    console.error(`\n[CRITICAL] Uncaught Exception: ${err.message}`);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n[CRITICAL] Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/brand", require("./routes/brandRoutes"));
app.use("/api/influencer", require("./routes/influencerRoutes"));
app.use("/api/match", require("./routes/matchRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/message", require("./routes/messageRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/nuro", require("./routes/nuroRoutes"));
app.use("/api/docs-agent", require("./routes/docsAgentRoutes"));
app.use("/api/workspace", require("./routes/workspaceRoutes"));
app.use("/api/deliverables", require("./routes/deliverableRoutes"));
app.use("/api/health", require("./routes/healthRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/time-agent", require("./routes/timeAgentRoutes"));
app.use("/api/orchestrator", require("./routes/orchestratorRoutes"));
app.use("/api/communication", require("./routes/communicationRoutes"));
app.use("/api/integrations", require("./routes/integrationRoutes"));
app.use("/api/resources", require("./routes/resourceRoutes"));
app.use("/api/action-agent", require("./routes/actionAgentRoutes"));
app.use("/api/actions", require("./routes/actionRoutes"));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: process.env.NODE_ENV === "production"
            ? "An internal server error occurred."
            : err.message
    });
});

// Socket.io Setup
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Attach Socket Handler
require("./socket/socketHandler")(io);
app.set("socketio", io);

app.use((req, res, next) => {
    req.io = io;
    next();
});

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, "../", "dist", "index.html"));
    });
}

const PORT = process.env.PORT || 5000;
server.timeout = 900000;
server.headersTimeout = 910000;
server.keepAliveTimeout = 90000;

// Database Connection and Server Startup
connectDB().then(() => {
    const ActionWorkflow = require("./models/ActionWorkflow");
    ActionWorkflow.updateMany(
        { status: { $in: ["running", "waiting", "intervention", "delayed", "retrying"] } },
        { $set: { status: "failed", activeMicroLog: "System restarted. Task terminated for stability." } }
    ).then(res => {
        if (res.modifiedCount > 0) {
            console.log(`\n[RECOVERY] Reset ${res.modifiedCount} stuck Action Agent tasks on startup.`);
        }
    }).catch(err => console.error("[RECOVERY] Failed to reset tasks:", err.message));

    server.listen(PORT, () => {
        console.log(`\n================================================`);
        console.log(`🚀 NUROTRA BACKEND ACTIVE ON PORT ${PORT}`);
        console.log(`🕒 System Time: ${new Date().toISOString()}`);
        console.log(`📡 OpenAI: ${process.env.OPENAI_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
        console.log(`================================================\n`);
    });
});

module.exports = app;
