const jwt = require("jsonwebtoken");
const User = require("../models/User");
const mongoose = require("mongoose");

const protect = async (req, res, next) => {
    let token;

    console.log(`[Auth] Debug: Method=${req.method} URL=${req.url}`);
    console.log(`[Auth] Debug: Query=`, req.query);

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1];
        console.log("[Auth] Token extracted from Authorization header");
    } else if (req.query.token) {
        token = req.query.token;
        console.log("[Auth] Token extracted from Query string");
    }

    if (token) {
        // FAIL FAST: If DB is not connected, don't even try to find user
        if (mongoose.connection.readyState !== 1) {
            console.warn(`[Auth] DB Offline (State: ${mongoose.connection.readyState}). Rejecting request fast.`);
            return res.status(503).json({ message: "Database offline. Please try again later.", dbOffline: true });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // FAIL FAST: Use a timeout for DB lookup during auth
            req.user = await User.findById(decoded.id).select("-password").maxTimeMS(2000);
            if (!req.user) {
                return res.status(401).json({ message: "Not authorized, user not found" });
            }
            return next();
        } catch (error) {
            console.error("[Auth] Token verification failed:", error.message);
            return res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Not authorized as an admin" });
    }
};

module.exports = { protect, admin };
