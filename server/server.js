require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
app.set("trust proxy", 1); // Trust first key for HTTPS on Render/Vercel

// Middleware
app.use(express.json());
app.use(cors());
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
