// index.js - Application entry point for modular CyTube bot
const { 
    EventBus,
    ModuleLoader,
    ModuleRegistry,
    UnifiedScheduler,
    PerformanceMonitor,
    ErrorHandler
} = require('./src/core');

const ConfigManager = require('./src/core/ConfigManager');

const createLogger = require('./src/utils/createLogger');

async function main() {
    console.log('Starting CyTube Bot - Modular Architecture');
    console.log('==========================================');
    
    try {
        // Initialize configuration
        console.log('Loading configuration...');
        const config = await ConfigManager.load();
        
        // Create logger
        console.log('Initializing logger...');
        const logger = await createLogger(config.logging);
        
        // Initialize core components
        logger.info('Initializing core components...');
        
        const eventBus = new EventBus(config.core?.eventBus);
        const scheduler = new UnifiedScheduler(config.core?.scheduler);
        const performanceMonitor = new PerformanceMonitor(config.core?.performance);
        const errorHandler = new ErrorHandler(config.core?.errorHandler);
        const moduleRegistry = new ModuleRegistry();
        
        // Initialize error handler with dependencies
        errorHandler.initialize(moduleRegistry, eventBus, logger);
        
        // Create room connections map
        const roomConnections = new Map();
        
        // Create context for modules
        const context = {
            eventBus,
            config,
            scheduler,
            performanceMonitor,
            moduleRegistry,
            logger,
            roomConnections
        };
        
        // Initialize module loader
        logger.info('Discovering modules...');
        const moduleLoader = new ModuleLoader(context);
        const modules = await moduleLoader.discoverModules();
        
        logger.info(`Found ${modules.length} modules`);
        
        // Load and register each module
        for (const moduleInfo of modules) {
            try {
                logger.info(`Loading module: ${moduleInfo.name} v${moduleInfo.manifest.version}`);
                const instance = await moduleLoader.loadModule(moduleInfo);
                
                if (instance) {
                    moduleRegistry.register(
                        moduleInfo.name,
                        instance,
                        moduleInfo.manifest
                    );
                    logger.info(`Registered module: ${moduleInfo.name}`);
                }
            } catch (error) {
                logger.error(`Failed to load module ${moduleInfo.name}:`, error);
                // Continue loading other modules
            }
        }
        
        // Initialize all modules in dependency order
        logger.info('Initializing modules...');
        await moduleRegistry.initializeModules();
        
        // Start all modules
        logger.info('Starting modules...');
        await moduleRegistry.startModules();
        
        // Set up graceful shutdown handlers
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, starting graceful shutdown...`);
            
            try {
                // Stop performance monitoring
                performanceMonitor.stopMonitoring();
                
                // Stop all modules
                await moduleRegistry.stopModules();
                
                // Stop scheduler
                await scheduler.stop();
                
                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };
        
        // Register shutdown handlers
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught errors (already handled by ErrorHandler, but as backup)
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection:', { reason, promise });
            shutdown('unhandledRejection');
        });
        
        // Log startup complete
        logger.info('Bot startup complete!');
        logger.info('Active modules:', Array.from(moduleRegistry.modules.keys()));
        
        // Start monitoring if API module is loaded
        const apiModule = moduleRegistry.getInstance('core-api');
        if (apiModule) {
            const { port, host } = apiModule.config;
            logger.info(`API server available at http://${host}:${port}`);
        }
        
        // Keep process alive
        logger.info('Bot is running. Press Ctrl+C to stop.');
        
    } catch (error) {
        console.error('Fatal error during startup:', error);
        process.exit(1);
    }
}

// Handle startup errors
main().catch((error) => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});