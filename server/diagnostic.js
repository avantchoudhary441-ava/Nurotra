const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = require('./models/User');

        const influencers = await User.countDocuments({ role: 'influencer' });
        const brands = await User.countDocuments({ role: 'brand' });
        const admins = await User.countDocuments({ role: 'admin' });
        const others = await User.countDocuments({ role: { $nin: ['influencer', 'brand', 'admin'] } });

        console.log('--- DATABASE DIAGNOSTICS ---');
        console.log('Influencers:', influencers);
        console.log('Brands:', brands);
        console.log('Admins:', admins);
        console.log('Others (user role):', others);
        console.log('Total (non-admin):', influencers + brands + others);
        console.log('---------------------------');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
