const mongoose = require('mongoose');
require('dotenv').config();

const NuroMemory = mongoose.model('NuroMemory', new mongoose.Schema({}, { strict: false }), 'nuromemories');
const Contact = mongoose.model('Contact', new mongoose.Schema({}, { strict: false }), 'contacts');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  // Check Akshat's memory specifically
  const akshatId = '69764ff88c0e59dbecc6c578';
  const memory = await NuroMemory.findOne({ userId: akshatId }).lean();
  
  console.log('\n=== AKSHAT SHARMA - NUROMEMORY ===');
  console.log('Behavioral Traits:');
  (memory?.behavioralPatterns || []).forEach(t => {
    console.log(`  ✔ ${t.trait} (confidence: ${t.confidence}%)`);
  });
  console.log('\nMission:', memory?.longTermPlan?.mission || 'Not detected yet');
  console.log('Active Goals:');
  (memory?.longTermPlan?.activeGoals || []).forEach(g => console.log(`  → ${g}`));

  // Check all contacts with relationship roles
  const contacts = await Contact.find({ 'metadata.relationshipRole': { $exists: true, $ne: '' } }, 'name metadata userId').lean();
  console.log('\n=== CONTACTS WITH RELATIONSHIP ROLES ===');
  if (!contacts.length) {
    console.log('  No contacts with roles found.');
    console.log('  (This updates when a user explicitly mentions someone from the Communication Agent)');
  }
  contacts.forEach(c => {
    console.log(`  ${c.name} -> ${c.metadata.relationshipRole} | ${c.metadata.relationshipContext || ''}`);
  });

  process.exit(0);
});
