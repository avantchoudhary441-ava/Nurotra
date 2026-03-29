const mongoose = require('mongoose');
const User = require('./models/User'); 
require('dotenv').config();

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'name email password');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listUsers();
