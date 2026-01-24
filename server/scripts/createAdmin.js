const User = require("../models/User");

/**
 * Safely creates an admin user if they don't exist.
 * This version is designed to be required by server.js and doesn't use process.exit().
 */
const createAdmin = async () => {
    try {
        const email = "admin@nurotra.com";
        const password = "admin123";

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            console.log(">>> [Admin Setup] Admin user already exists:", email);

            // Ensure the existing admin is verified just in case
            if (!user.isVerified) {
                user.isVerified = true;
                await user.save();
                console.log(">>> [Admin Setup] Existing admin marked as verified.");
            }
            return;
        }

        // Create new admin
        user = new User({
            name: "Super Admin",
            email,
            password, // Schema pre-save hook will hash this
            role: "admin",
            uniqueId: "admin-001",
            isVerified: true,
            profileImg: "https://cdn-icons-png.flaticon.com/512/2942/2942813.png"
        });

        await user.save();
        console.log(">>> [Admin Setup] Admin user created successfully:", email);
    } catch (err) {
        console.error(">>> [Admin Setup] Error occurred:", err.message);
    }
};

module.exports = createAdmin;
