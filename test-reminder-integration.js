/**
 * Test script to verify reminder-system module integration with legacy bot.js
 */

import { CyTubeBot } from './src/core/bot.js';
import { createLogger } from './src/utils/logger.js';

// Test configuration (minimal to avoid CyTube connection)
const config = {
    cytube: {
        channel: 'fatpizza',
        password: null,
        baseURL: 'offline' // Prevent connection
    },
    database: {
        path: './cytube_stats.db'
    },
    bot: {
        username: 'dazza'
    },
    reminder: {
        checkInterval: 60000 // 1 minute
    },
    logging: {
        level: 'info',
        console: true
    }
};

async function testReminderSystemIntegration() {
    const logger = createLogger({ level: 'info', console: true });
    
    try {
        logger.info('🔬 Testing reminder-system module integration...');
        
        // Create bot instance
        const bot = new CyTubeBot(config);
        
        // Initialize database and modules (skip connection)
        await bot.db.init();
        bot.db.setBot(bot);
        bot.services.set('database', bot.db);
        
        // Load both tell-system and reminder-system modules
        await bot.loadTellSystemModule();
        await bot.loadReminderSystemModule();
        
        // Check if both services are registered
        const tellService = bot.services.get('tellSystem');
        const reminderService = bot.services.get('reminderSystem');
        
        if (!tellService) {
            throw new Error('Tell-system service not registered');
        }
        
        if (!reminderService) {
            throw new Error('Reminder-system service not registered');
        }
        
        logger.info('✅ SUCCESS: Both tell-system and reminder-system services registered');
        logger.info('📋 Tell service methods:', Object.keys(tellService));
        logger.info('📋 Reminder service methods:', Object.keys(reminderService));
        
        // Test the checkReminders method
        logger.info('🧪 Testing checkReminders method...');
        
        let messagesSent = [];
        
        // Mock bot's sendMessage
        bot.sendMessage = (message) => {
            messagesSent.push(message);
            logger.info('📤 Reminder message sent:', message);
        };
        
        // Create a mock userlist
        bot.userlist = new Map();
        bot.userlist.set('testuser', { name: 'TestUser' });
        
        // Test reminder checking
        await reminderService.checkReminders();
        
        logger.info('✅ SUCCESS: checkReminders executed without errors');
        logger.info(`📊 Reminder messages sent: ${messagesSent.length}`);
        
        // Check module status
        const reminderModule = bot.modules.get('reminder-system');
        const tellModule = bot.modules.get('tell-system');
        
        if (reminderModule && tellModule) {
            logger.info('✅ SUCCESS: Both modules accessible');
            logger.info('📊 Reminder module status:', reminderModule.getStatus());
            logger.info('📊 Tell module status:', tellModule.getStatus());
        }
        
        // Test service status
        logger.info('📊 Reminder service status:', reminderService.getStatus());
        
        // Cleanup
        await reminderService.stop(); // Stop the reminder checking interval
        await bot.db.close();
        logger.info('🎉 ALL TESTS PASSED - Reminder-system integration is working!');
        
    } catch (error) {
        logger.error('❌ TEST FAILED:', error.message);
        logger.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
testReminderSystemIntegration();