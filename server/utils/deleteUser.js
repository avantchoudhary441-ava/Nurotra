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
const PendingUser = require('../models/PendingUser');

const emailsToDelete = [
    'dwivediananya1406@gmail.com',
    'shruti28052003@gmail.com'
];

async function deleteUsers() {
    try {
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        for (const email of emailsToDelete) {
            console.log(`\n--- Deleting User: ${email} ---`);

            // 1. Find the user in main collection
            const user = await User.findOne({ email });
            let userId = user ? user._id : null;

            if (!userId) {
                console.log(`ℹ️ User ${email} not found in main collection. Checking Pending...`);
                const pending = await PendingUser.deleteOne({ email });
                if (pending.deletedCount > 0) {
                    console.log(`✅ Deleted ${email} from PendingUser collection.`);
                } else {
                    console.log(`❌ User ${email} not found anywhere.`);
                }
                continue;
            }

            // 2. Delete related records
            const results = {
                User: await User.deleteOne({ _id: userId }),
                Brand: await Brand.deleteMany({ userId: userId }),
                Influencer: await Influencer.deleteMany({ userId: userId }),
                Deliverable: await Deliverable.deleteMany({ userId: userId }),
                NuroMemory: await NuroMemory.deleteMany({ userId: userId }),
                MessagesSent: await Message.deleteMany({ sender: userId }),
                ChatsParticipating: await Chat.deleteMany({ users: userId }),
                PendingEntry: await PendingUser.deleteOne({ email: email })
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
