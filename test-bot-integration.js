/**
 * Test script to verify tell-system module integration with legacy bot.js
 */

import { CyTubeBot } from './src/core/bot.js';
import { createLogger } from './src/utils/logger.js';

// Test configuration
const config = {
    cytube: {
        channel: 'fatpizza',
        password: null
    },
    database: {
        path: './cytube_stats_modular.db'
    },
    bot: {
        username: 'dazza'
    },
    logging: {
        level: 'info',
        console: true
    }
};

async function testTellSystemIntegration() {
    const logger = createLogger({ level: 'info', console: true });
    
    try {
        logger.info('Testing tell-system module integration...');
        
        // Create bot instance
        const bot = new CyTubeBot(config);
        
        // Initialize bot (this should load the tell-system module)
        await bot.init();
        
        // Check if tell-system service is registered
        const tellService = bot.services.get('tellSystem');
        if (tellService) {
            logger.info('SUCCESS: Tell-system service is registered');
            logger.info('Available service methods:', Object.keys(tellService));
        } else {
            logger.error('FAILED: Tell-system service not found');
            logger.info('Available services:', Array.from(bot.services.keys()));
        }
        
        // Test checkAndDeliverTells method
        logger.info('Testing checkAndDeliverTells method...');
        bot.checkAndDeliverTells('testuser');
        logger.info('SUCCESS: checkAndDeliverTells executed without errors');
        
        // Check if module is loaded
        const tellModule = bot.modules.get('tell-system');
        if (tellModule) {
            logger.info('SUCCESS: Tell-system module is loaded');
            logger.info('Module status:', tellModule.getStatus());
        } else {
            logger.error('FAILED: Tell-system module not found');
            logger.info('Available modules:', Array.from(bot.modules.keys()));
        }
        
        // Cleanup
        await bot.shutdown();
        logger.info('Test completed successfully');
        
    } catch (error) {
        logger.error('Test failed:', error.message);
        logger.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run test
testTellSystemIntegration();