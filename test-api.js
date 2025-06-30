import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001/api/v1';
const WS_URL = 'http://localhost:3001';

console.log('Testing Dazza Bot API...\n');

// Test REST API endpoints
async function testEndpoints() {
    console.log('1. Testing REST API Endpoints:');
    console.log('================================');
    
    // Test health endpoint
    try {
        console.log('\n[GET] /api/v1/health');
        const healthRes = await fetch(`${API_BASE}/health`);
        const healthData = await healthRes.json();
        console.log('✓ Status:', healthRes.status);
        console.log('✓ Response:', JSON.stringify(healthData, null, 2));
    } catch (err) {
        console.error('✗ Health check failed:', err.message);
    }
    
    // Test health/detailed endpoint
    try {
        console.log('\n[GET] /api/v1/health/detailed');
        const detailedRes = await fetch(`${API_BASE}/health/detailed`);
        const detailedData = await detailedRes.json();
        console.log('✓ Status:', detailedRes.status);
        console.log('✓ Response:', JSON.stringify(detailedData, null, 2));
    } catch (err) {
        console.error('✗ Detailed health check failed:', err.message);
    }
    
    // Test gallery locks endpoint
    try {
        console.log('\n[GET] /api/v1/gallery/locks');
        const locksRes = await fetch(`${API_BASE}/gallery/locks`, {
            headers: {
                'Origin': 'https://hildolfr.github.io'
            }
        });
        const locksData = await locksRes.json();
        console.log('✓ Status:', locksRes.status);
        console.log('✓ Response:', JSON.stringify(locksData, null, 2));
    } catch (err) {
        console.error('✗ Gallery locks failed:', err.message);
    }
    
    // Test user stats endpoint (example user)
    try {
        console.log('\n[GET] /api/v1/stats/users/dazza');
        const statsRes = await fetch(`${API_BASE}/stats/users/dazza`);
        const statsData = await statsRes.json();
        console.log('✓ Status:', statsRes.status);
        console.log('✓ Response:', JSON.stringify(statsData, null, 2));
    } catch (err) {
        console.error('✗ User stats failed:', err.message);
    }
    
    // Test channel stats
    try {
        console.log('\n[GET] /api/v1/stats/channel');
        const channelRes = await fetch(`${API_BASE}/stats/channel`);
        const channelData = await channelRes.json();
        console.log('✓ Status:', channelRes.status);
        console.log('✓ Response:', JSON.stringify(channelData, null, 2));
    } catch (err) {
        console.error('✗ Channel stats failed:', err.message);
    }
    
    // Test CORS rejection
    try {
        console.log('\n[DELETE] /api/v1/gallery/images (testing CORS rejection)');
        const corsRes = await fetch(`${API_BASE}/gallery/images`, {
            method: 'DELETE',
            headers: {
                'Origin': 'https://evil.com',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: 'test.jpg' })
        });
        console.log('✗ CORS check status:', corsRes.status);
        if (corsRes.status === 403) {
            console.log('✓ CORS properly blocked unauthorized origin');
        }
    } catch (err) {
        console.log('✓ CORS properly rejected request:', err.message);
    }
}

// Test WebSocket connection
async function testWebSocket() {
    console.log('\n\n2. Testing WebSocket Connection:');
    console.log('================================');
    
    const socket = io(WS_URL, {
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('✓ Connected to WebSocket server');
        console.log('✓ Socket ID:', socket.id);
        
        // Subscribe to topics
        socket.emit('subscribe', ['gallery', 'stats', 'chat']);
    });
    
    socket.on('welcome', (data) => {
        console.log('✓ Received welcome message:', JSON.stringify(data, null, 2));
    });
    
    socket.on('subscribed', (data) => {
        console.log('✓ Subscribed to topics:', data.topics);
        
        // Test ping/pong
        socket.emit('ping');
    });
    
    socket.on('pong', (data) => {
        console.log('✓ Ping/Pong working, timestamp:', data.timestamp);
        
        // Close after tests
        setTimeout(() => {
            socket.disconnect();
            console.log('\n✓ All tests completed!');
            process.exit(0);
        }, 1000);
    });
    
    socket.on('error', (err) => {
        console.error('✗ WebSocket error:', err);
    });
    
    socket.on('connect_error', (err) => {
        console.error('✗ WebSocket connection error:', err.message);
        process.exit(1);
    });
}

// Run tests
async function runTests() {
    await testEndpoints();
    await testWebSocket();
}

// Wait a moment for the API server to be ready
setTimeout(() => {
    runTests().catch(err => {
        console.error('Test failed:', err);
        process.exit(1);
    });
}, 2000);

console.log('Waiting for API server to be ready...');