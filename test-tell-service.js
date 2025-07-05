/**
 * Focused test for tell-system service integration
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
    logging: {
        level: 'info',
        console: true
    }
};

async function testTellServiceOnly() {
    const logger = createLogger({ level: 'info', console: true });
    
    try {
        logger.info('🔬 Testing tell-system service integration...');
        
        // Create bot instance
        const bot = new CyTubeBot(config);
        
        // Initialize database and tell-system only (skip connection)
        await bot.db.init();
        bot.db.setBot(bot);
        bot.services.set('database', bot.db);
        
        // Load tell-system module directly
        await bot.loadTellSystemModule();
        
        // Check if service is registered
        const tellService = bot.services.get('tellSystem');
        if (!tellService) {
            throw new Error('Tell-system service not registered');
        }
        
        logger.info('✅ SUCCESS: Tell-system service registered');
        logger.info('📋 Available methods:', Object.keys(tellService));
        
        // Test the checkAndDeliverTells method
        logger.info('🧪 Testing checkAndDeliverTells method...');
        
        let messagesSent = [];
        let pmsSent = [];
        
        // Mock room context to capture messages
        const mockRoom = {
            sendMessage: (message) => {
                messagesSent.push(message);
                logger.info('📤 Mock message sent:', message);
            },
            sendPM: (username, message) => {
                pmsSent.push({ username, message });
                logger.info('📧 Mock PM sent to', username + ':', message);
            }
        };
        
        // Test with a user who might have tells
        await tellService.checkAndDeliverTells('testuser', mockRoom);
        
        logger.info('✅ SUCCESS: checkAndDeliverTells executed without errors');
        logger.info(`📊 Messages sent: ${messagesSent.length}, PMs sent: ${pmsSent.length}`);
        
        // Test bot's checkAndDeliverTells wrapper
        logger.info('🧪 Testing bot.checkAndDeliverTells wrapper...');
        
        // Reset counters
        messagesSent = [];
        pmsSent = [];
        
        // Mock bot's sendMessage and sendPrivateMessage
        bot.sendMessage = (message) => {
            messagesSent.push(message);
            logger.info('📤 Bot message sent:', message);
        };
        bot.sendPrivateMessage = (username, message) => {
            pmsSent.push({ username, message });
            logger.info('📧 Bot PM sent to', username + ':', message);
        };
        
        // Test bot's wrapper method
        bot.checkAndDeliverTells('testuser');
        
        logger.info('✅ SUCCESS: bot.checkAndDeliverTells executed without errors');
        
        // Check module status
        const tellModule = bot.modules.get('tell-system');
        if (tellModule) {
            logger.info('✅ SUCCESS: Tell-system module accessible');
            logger.info('📊 Module status:', tellModule.getStatus());
        }
        
        // Cleanup
        await bot.db.close();
        logger.info('🎉 ALL TESTS PASSED - Tell-system integration is working!');
        
    } catch (error) {
        logger.error('❌ TEST FAILED:', error.message);
        logger.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
testTellServiceOnly();