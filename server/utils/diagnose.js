const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'dwivediananya1406@gmail.com';

        console.log(`Searching for ALL records with: ${email}`);

        const users = await User.find({ email });
        console.log(`Found ${users.length} users.`);
        users.forEach((u, i) => {
            console.log(`User ${i + 1}:`, { _id: u._id, isVerified: u.isVerified, role: u.role, createdAt: u.createdAt });
        });

        const indexes = await User.collection.getIndexes();
        console.log('Indexes on User collection:', JSON.stringify(indexes, null, 2));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
} diagnose();
