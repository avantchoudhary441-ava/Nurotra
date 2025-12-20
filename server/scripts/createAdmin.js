require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

const createAdmin = async () => {
    try {
        await connectDB();

        const email = "admin@nurotra.com";
        const password = "admin123";

        let user = await User.findOne({ email });

        if (user) {
            console.log("Admin user already exists");
            process.exit();
        }

        user = new User({
            name: "Super Admin",
            email,
            password, // Schema pre-save will hash this
            role: "admin",
            uniqueId: "admin-001",
            profileImg: "https://cdn-icons-png.flaticon.com/512/2942/2942813.png" // Cool Admin Icon
        });

        await user.save();
        console.log("Admin user created successfully");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createAdmin();
