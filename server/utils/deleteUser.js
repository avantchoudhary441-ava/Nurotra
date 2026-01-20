const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Brand = require('../models/Brand');
const Influencer = require('../models/Influencer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Deliverable = require('../models/Deliverable');
const NuroMemory = require('../models/NuroMemory');

const emailsToDelete = [
    'nurotra435@gmail.com',
    'pulse9822@gmail.com'
];

async function deleteUsers() {
    try {
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        for (const email of emailsToDelete) {
            console.log(`\n--- Deleting User: ${email} ---`);

            // 1. Find the user
            const user = await User.findOne({ email });
            if (!user) {
                console.log(`❌ User not found: ${email}`);
                continue;
            }

            const userId = user._id;

            // 2. Delete related records
            const results = {
                User: await User.deleteOne({ _id: userId }),
                Brand: await Brand.deleteMany({ userId: userId }),
                Influencer: await Influencer.deleteMany({ userId: userId }),
                Deliverable: await Deliverable.deleteMany({ userId: userId }),
                NuroMemory: await NuroMemory.deleteMany({ userId: userId }),
                MessagesSent: await Message.deleteMany({ sender: userId }),
                ChatsParticipating: await Chat.deleteMany({ users: userId }),
            };

            console.log(`✅ Deletion results for ${email}:`);
            Object.entries(results).forEach(([model, res]) => {
                console.log(`   - ${model}: ${res.deletedCount} items deleted`);
            });
        }

        console.log('\n✨ Deletion completed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during deletion:', error);
        process.exit(1);
    }
}

deleteUsers();
