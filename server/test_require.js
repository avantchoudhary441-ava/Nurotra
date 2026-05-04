try {
    const User = require('./models/User');
    console.log('✅ User model loaded successfully from test script.');
} catch (err) {
    console.error('❌ Failed to load User model:', err.message);
}
