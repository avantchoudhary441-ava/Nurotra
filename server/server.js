require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const helmet = require("helmet");
const compression = require("compression");

const app = express();
app.set("trust proxy", 1); // Trust first key for HTTPS on Render/Vercel

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
// Production CORS Configuration
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    process.env.CLIENT_URL,
    process.env.VERCEL_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(o => origin.startsWith(o))) {
            callback(null, true);
        } else {
            console.warn(`Blocked CORS request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
