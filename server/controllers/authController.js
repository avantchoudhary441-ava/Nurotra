const User = require("../models/User");
const BrandProfile = require("../models/BrandProfile");
const InfluencerProfile = require("../models/InfluencerProfile");
const jwt = require("jsonwebtoken");

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        // Security: Block 'admin' registration via public route
        if (role === "admin") {
            return res.status(403).json({ message: "Admin registration is restricted." });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const uniqueId = Date.now().toString(); // Simple ID generation

        const user = await User.create({
            name,
            email,
            password,
            role,
            uniqueId
        });

        if (user) {
            // Create empty profile based on role
            if (role === 'brand') {
                await BrandProfile.create({ user: user._id });
            } else if (role === 'influencer') {
                await InfluencerProfile.create({ user: user._id });
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                uniqueId: user.uniqueId,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                uniqueId: user.uniqueId,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, loginUser };
