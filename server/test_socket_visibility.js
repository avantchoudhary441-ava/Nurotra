const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
require('dotenv').config();

const User = require('./models/User');

async function testSocket() {
    console.log('[Test] Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('[Test] Finding a test user...');
    const user = await User.findOne();
    if (!user) {
        console.error('No user found to test with.');
        process.exit(1);
    }
    
    console.log(`[Test] Generating token for user ${user._id}...`);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    console.log('[Test] Connecting to Socket.io local server...');
    const socket = io('http://localhost:5000', {
        transports: ['websocket'],
        auth: { token }
    });
    
    let verified = false;

    socket.on('connect', () => {
        console.log(`[Test] Socket connected successfully! ID: ${socket.id}`);
        
        console.log('[Test] Emitting "test_sync" event...');
        socket.emit('test_sync', {
            platform: 'Google Sheets',
            action: 'simulated_sync',
            status: 'completed',
            payload: { note: 'Socket Auth Verification Test' }
        });
    });
    
    socket.on('connect_error', (err) => {
        console.error('[Test] Socket connection error:', err.message);
        mongoose.disconnect();
        process.exit(1);
    });

    socket.on('sync_activity', (data) => {
        console.log('[Test] SUCCESS: Received sync_activity event!');
        console.log(JSON.stringify(data, null, 2));
        verified = true;
        socket.disconnect();
    });

    socket.on('disconnect', () => {
        console.log('[Test] Socket disconnected.');
        mongoose.disconnect();
        if (verified) {
            console.log('[Test] Visibility verification PASSED.');
            process.exit(0);
        } else {
            console.error('[Test] Visibility verification FAILED (Did not receive activity back).');
            process.exit(1);
        }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
        if (!verified) {
            console.error('[Test] Timeout waiting for sync_activity event.');
            socket.disconnect();
        }
    }, 5000);
}

testSocket().catch(e => {
    console.error(e);
    process.exit(1);
});
