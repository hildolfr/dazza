#!/usr/bin/env node

import WebSocket from 'ws';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

console.log('🎨 Testing Gallery API and WebSocket Features...\n');

// Test WebSocket connection
console.log('📡 Connecting to WebSocket...');
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ WebSocket connected!\n');
    
    // Listen for gallery events
    console.log('👂 Listening for gallery events...');
});

ws.on('message', (data) => {
    try {
        const event = JSON.parse(data);
        
        if (event.type.startsWith('gallery:')) {
            console.log(`\n🖼️  Gallery Event: ${event.type}`);
            console.log('📊 Data:', JSON.stringify(event.data, null, 2));
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

// Test API endpoints
async function testGalleryAPI() {
    console.log('\n🧪 Testing Gallery API Endpoints...\n');
    
    try {
        // Test gallery stats
        console.log('📊 Getting gallery statistics...');
        const statsRes = await fetch(`${API_URL}/api/v1/gallery/stats`);
        const stats = await statsRes.json();
        
        if (stats.success) {
            console.log('✅ Gallery Stats:');
            console.log(`   - Total Users: ${stats.data.overview.totalUsers}`);
            console.log(`   - Total Images: ${stats.data.overview.totalImages}`);
            console.log(`   - Active Images: ${stats.data.overview.activeImages}`);
            console.log(`   - Deleted Images: ${stats.data.overview.deletedImages}`);
            
            if (stats.data.topUploaders.length > 0) {
                console.log('\n   🏆 Top Uploaders:');
                stats.data.topUploaders.slice(0, 5).forEach((user, i) => {
                    console.log(`   ${i + 1}. ${user.username}: ${user.imageCount} images (${user.activeCount} active)`);
                });
            }
        }
        
        // Test activity feed
        console.log('\n📜 Getting recent gallery activity...');
        const activityRes = await fetch(`${API_URL}/api/v1/gallery/activity?limit=5`);
        const activity = await activityRes.json();
        
        if (activity.success && activity.data.activities.length > 0) {
            console.log('✅ Recent Activity:');
            activity.data.activities.forEach(act => {
                const action = act.activityType === 'added' ? '➕ Added' : '❌ Deleted';
                console.log(`   ${action}: ${act.username} - ${act.url.substring(0, 50)}...`);
            });
        } else {
            console.log('   No recent activity');
        }
        
        // Test image metadata extraction
        console.log('\n🔍 Testing image metadata extraction...');
        const testUrl = 'https://i.imgur.com/example.jpg';
        const metadataRes = await fetch(`${API_URL}/api/v1/gallery/images/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: testUrl })
        });
        const metadata = await metadataRes.json();
        
        if (metadata.success) {
            console.log('✅ Metadata extracted:');
            console.log(`   - URL: ${metadata.data.url}`);
            console.log(`   - Domain: ${metadata.data.domain}`);
            console.log(`   - Accessible: ${metadata.data.accessible}`);
            if (metadata.data.error) {
                console.log(`   - Error: ${metadata.data.error}`);
            }
        }
        
        // Test gallery locks
        console.log('\n🔒 Getting gallery locks...');
        const locksRes = await fetch(`${API_URL}/api/v1/gallery/locks`);
        const locks = await locksRes.json();
        
        if (locks.success) {
            const lockedCount = locks.data.locks.filter(l => l.isLocked).length;
            console.log(`✅ Gallery Locks: ${lockedCount} locked, ${locks.data.locks.length - lockedCount} unlocked`);
            
            if (locks.data.locks.length > 0) {
                console.log('   Recent locks:');
                locks.data.locks.slice(0, 3).forEach(lock => {
                    const status = lock.isLocked ? '🔒 Locked' : '🔓 Unlocked';
                    console.log(`   - ${lock.username}: ${status} (${lock.imageCount} images)`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ API test failed:', error.message);
    }
}

// Run API tests after a short delay
setTimeout(testGalleryAPI, 1000);

// Keep the script running to listen for WebSocket events
console.log('\n💡 Script will continue running to monitor WebSocket events.');
console.log('   Post an image in the chat to see real-time events!');
console.log('   Press Ctrl+C to exit.\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Closing connections...');
    ws.close();
    process.exit(0);
});