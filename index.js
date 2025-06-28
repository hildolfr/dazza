import { CyTubeBot } from './src/core/bot.js';
import config from './src/config/index.js';
import { ConfigValidator } from './src/config/validator.js';

async function main() {
    // Validate configuration
    const validator = new ConfigValidator();
    const validation = validator.validate(config);
    
    if (!validation.valid) {
        validator.printReport();
        console.error('\n❌ Cannot start bot with invalid configuration');
        process.exit(1);
    }
    
    if (validation.warnings.length > 0) {
        validator.printReport();
    }
    
    const bot = new CyTubeBot(config);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await bot.shutdown();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await bot.shutdown();
        process.exit(0);
    });
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        bot.shutdown().then(() => process.exit(1));
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    try {
        console.log('Starting CyTube Bot...');
        await bot.init();
        console.log('Bot is running!');
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Run the bot
main();