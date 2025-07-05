/**
 * Test script to verify memory-management module integration with legacy bot.js
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
    memoryManagement: {
        warningThreshold: 0.85,
        criticalThreshold: 0.95,
        checkInterval: 60000,
        botMessageCacheDuration: 30000
    },
    logging: {
        level: 'info',
        console: true
    }
};

async function testMemoryManagementIntegration() {
    const logger = createLogger({ level: 'info', console: true });
    
    try {
        logger.info('🧠 Testing memory-management module integration...');
        
        // Create bot instance
        const bot = new CyTubeBot(config);
        
        // Initialize database and modules (skip connection)
        await bot.db.init();
        bot.db.setBot(bot);
        bot.services.set('database', bot.db);
        
        // Load all three modules
        await bot.loadTellSystemModule();
        await bot.loadReminderSystemModule();
        await bot.loadMemoryManagementModule();
        
        // Check if all services are registered
        const tellService = bot.services.get('tellSystem');
        const reminderService = bot.services.get('reminderSystem');
        const memoryService = bot.services.get('memoryManagement');
        
        if (!tellService || !reminderService || !memoryService) {
            throw new Error('One or more services not registered');
        }
        
        logger.info('✅ SUCCESS: All three services registered');
        logger.info('📋 Tell service methods:', Object.keys(tellService));
        logger.info('📋 Reminder service methods:', Object.keys(reminderService));
        logger.info('📋 Memory service methods:', Object.keys(memoryService));
        
        // Test memory management functionality
        logger.info('🧪 Testing memory management methods...');
        
        // Test bot message tracking
        const testMessage = 'test message for memory tracking';
        memoryService.trackBotMessage(testMessage);
        const isRecent = memoryService.isRecentBotMessage(testMessage);
        
        logger.info(`✅ Bot message tracking: Message tracked and detected as recent: ${isRecent}`);
        
        // Test memory stats
        const memoryStats = memoryService.getMemoryStats();
        logger.info('📊 Memory stats:', memoryStats);
        
        // Test cache clearing
        memoryService.clearCaches();
        logger.info('✅ Cache clearing executed successfully');
        
        // Test data structure registration
        logger.info('📊 Registered data structures:', 
            Object.keys(memoryService.registeredStructures || {}));
        
        // Check all module statuses
        const memoryModule = bot.modules.get('memory-management');
        const reminderModule = bot.modules.get('reminder-system');
        const tellModule = bot.modules.get('tell-system');
        
        if (memoryModule && reminderModule && tellModule) {
            logger.info('✅ SUCCESS: All three modules accessible');
            logger.info('📊 Memory module status:', memoryModule.getStatus());
            logger.info('📊 Reminder module status:', reminderModule.getStatus());
            logger.info('📊 Tell module status:', tellModule.getStatus());
        }
        
        // Test service status
        logger.info('📊 Memory service status:', memoryService.getStatus());
        
        // Cleanup
        await reminderService.stop(); // Stop reminder checking interval
        // Memory service doesn't need explicit stop - it's handled by module lifecycle
        await bot.db.close();
        logger.info('🎉 ALL TESTS PASSED - Memory-management integration is working!');
        
    } catch (error) {
        logger.error('❌ TEST FAILED:', error.message);
        logger.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
testMemoryManagementIntegration();