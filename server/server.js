require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
app.set("trust proxy", 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Production CORS Configuration
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "https://nurotra.online",
    "https://www.nurotra.online",
    "https://nurotra.vercel.app"
];

// Add environment variables if they exist
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
            console.warn(`Blocked CORS request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later."
});
app.use("/api/", apiLimiter);
const passport = require("./config/passport");
app.use(passport.initialize());

// Database Connection
connectDB();

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
app.use("/api/admin", require("./routes/adminRoutes"));

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


// Serve static assets in production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, "../", "dist", "index.html"));
    });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
