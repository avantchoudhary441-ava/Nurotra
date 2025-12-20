const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
require('dotenv').config();

const generateToken = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Create or Find a Mock Google User
        const testEmail = "test_google_user@gmail.com";
        let user = await User.findOne({ email: testEmail });

        if (!user) {
            user = await User.create({
                name: "Test Google User",
                email: testEmail,
                googleId: "mock_google_id_12345",
                profileImg: "https://lh3.googleusercontent.com/a/ACg8ocIq8j",
                role: "user",
                uniqueId: "test_nuro_id_999"
            });
            console.log("Created Test User");
        } else {
            console.log("Found Test User");
        }

        // Generate Token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log("TOKEN_Generated: " + token);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

generateToken();
