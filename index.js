import { CyTubeBot } from './src/core/MultiRoomBot.js';
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
    let shutdownInProgress = false;
    
    const gracefulShutdown = async (signal) => {
        if (shutdownInProgress) {
            console.log('Shutdown already in progress...');
            return;
        }
        
        shutdownInProgress = true;
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        
        // Set a hard timeout for shutdown
        const shutdownTimeout = setTimeout(() => {
            console.error('Shutdown timeout exceeded, forcing exit...');
            process.exit(1);
        }, 3000); // 3 second timeout
        
        try {
            await bot.shutdown();
            clearTimeout(shutdownTimeout);
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            clearTimeout(shutdownTimeout);
            process.exit(1);
        }
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        bot.shutdown().then(() => process.exit(1));
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Force exit if process doesn't terminate cleanly
    process.on('exit', (code) => {
        console.log(`Process exiting with code: ${code}`);
    });
    
    // Additional safety for hanging processes
    process.on('beforeExit', (code) => {
        console.log(`Process about to exit with code: ${code}`);
        // Force exit if there are still handles keeping the process alive
        // Exit immediately
        process.exit(code);
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