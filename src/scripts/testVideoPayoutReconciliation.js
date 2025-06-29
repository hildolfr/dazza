import Database from '../services/database.js';
import { VideoPayoutManager } from '../modules/video_payout/index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock bot object for testing
class MockBot {
    constructor() {
        this.userlist = new Map();
        this.config = {
            bot: { username: 'dazza' }
        };
    }
    
    getUserlist() {
        return this.userlist;
    }
    
    // Simulate adding users to the userlist
    addUser(username) {
        this.userlist.set(username.toLowerCase(), { name: username });
    }
    
    // Simulate removing users from the userlist
    removeUser(username) {
        this.userlist.delete(username.toLowerCase());
    }
    
    // Simulate clearing the userlist (what happens during race condition)
    clearUserlist() {
        this.userlist.clear();
    }
}

async function testReconciliation() {
    const db = new Database(path.join(__dirname, '../../test_video_payout.db'));
    const mockBot = new MockBot();
    
    try {
        await db.init();
        console.log('✓ Database initialized');
        
        const videoPayoutManager = new VideoPayoutManager(db, mockBot);
        await videoPayoutManager.init();
        console.log('✓ VideoPayoutManager initialized');
        
        // Test 1: Simulate race condition
        console.log('\n=== Test 1: Race Condition Simulation ===');
        
        // Add users to userlist
        mockBot.addUser('Alice');
        mockBot.addUser('Bob');
        mockBot.addUser('Charlie');
        console.log('Added 3 users to userlist');
        
        // Simulate media change with empty userlist (race condition)
        mockBot.clearUserlist();
        console.log('Cleared userlist (simulating race condition)');
        
        // Start a video session
        await videoPayoutManager.handleMediaChange({ 
            id: 'test123', 
            title: 'Test Video' 
        });
        console.log('Started video session with empty userlist');
        
        // Simulate userlist update arriving late
        await new Promise(resolve => setTimeout(resolve, 500));
        mockBot.addUser('Alice');
        mockBot.addUser('Bob');
        mockBot.addUser('Charlie');
        console.log('Userlist updated with 3 users');
        
        // Trigger reconciliation
        await videoPayoutManager.handleUserlistUpdate();
        
        // Check current watchers
        console.log(`Current watchers: ${videoPayoutManager.currentWatchers.size}`);
        console.log('Watchers:', Array.from(videoPayoutManager.currentWatchers.keys()));
        
        // Test 2: User join/leave during session
        console.log('\n=== Test 2: User Join/Leave ===');
        
        // Add a new user
        mockBot.addUser('David');
        await videoPayoutManager.handleUserJoin('David');
        console.log('David joined');
        
        // Remove a user
        mockBot.removeUser('Bob');
        await videoPayoutManager.handleUserLeave('Bob');
        console.log('Bob left');
        
        // Trigger reconciliation
        await videoPayoutManager.reconcileWatchers('test');
        
        console.log(`Current watchers after changes: ${videoPayoutManager.currentWatchers.size}`);
        console.log('Watchers:', Array.from(videoPayoutManager.currentWatchers.keys()));
        
        // Test 3: Multiple reconciliation attempts
        console.log('\n=== Test 3: Reconciliation Schedule ===');
        
        // End current session
        await videoPayoutManager.endSession();
        
        // Start new session with empty userlist
        mockBot.clearUserlist();
        await videoPayoutManager.handleMediaChange({ 
            id: 'test456', 
            title: 'Test Video 2' 
        });
        
        console.log('Started session with 0 watchers');
        console.log('Waiting for scheduled reconciliations...');
        
        // Wait for first reconciliation (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // Add users before second reconciliation
        mockBot.addUser('Alice');
        mockBot.addUser('Bob');
        
        // Wait for second reconciliation (4 seconds from start)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`Final watchers: ${videoPayoutManager.currentWatchers.size}`);
        console.log('Watchers:', Array.from(videoPayoutManager.currentWatchers.keys()));
        
        // Clean up
        await videoPayoutManager.endSession();
        
        console.log('\n✓ All tests completed successfully!');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await db.close();
        // Clean up test database
        const fs = await import('fs/promises');
        try {
            await fs.unlink(path.join(__dirname, '../../test_video_payout.db'));
            console.log('✓ Cleaned up test database');
        } catch (err) {
            // Ignore if file doesn't exist
        }
    }
}

// Run the test
testReconciliation();