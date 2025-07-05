// index.js - Application entry point for modular CyTube bot
import { 
    EventBus,
    ModuleLoader,
    ModuleRegistry,
    UnifiedScheduler,
    PerformanceMonitor,
    ErrorHandler
} from './src/core/index.js';

import ConfigManager from './src/core/ConfigManager.js';

import createLogger from './src/utils/createLogger.js';

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
        
        // Create service registry
        const services = new Map();
        
        // Set up service registration handler
        eventBus.on('service:register', ({ name, service }) => {
            services.set(name, service);
            logger.info(`Service registered: ${name}`);
        });
        
        // Create context for modules
        const context = {
            eventBus,
            config,
            scheduler,
            performanceMonitor,
            moduleRegistry,
            logger,
            roomConnections,
            services
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
        
        // Set up graceful shutdown handlers with timeout protection
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, starting graceful shutdown...`);
            
            // Set up forced exit timer
            const forceExitTimer = setTimeout(() => {
                console.error('Graceful shutdown timeout, forcing exit');
                process.exit(1);
            }, 30000); // 30 second timeout
            
            try {
                // Disable further error handling to prevent shutdown loops
                errorHandlerActive = false;
                
                // Stop performance monitoring first
                try {
                    performanceMonitor.stopMonitoring();
                } catch (error) {
                    logger.warn('Error stopping performance monitor:', error);
                }
                
                // Stop all modules with timeout
                try {
                    const moduleShutdownPromise = moduleRegistry.stopModules();
                    const moduleTimeout = setTimeout(() => {
                        logger.error('Module shutdown timeout, continuing with forced shutdown');
                    }, 20000);
                    
                    await Promise.race([
                        moduleShutdownPromise,
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Module shutdown timeout')), 20000)
                        )
                    ]);
                    
                    clearTimeout(moduleTimeout);
                } catch (error) {
                    logger.error('Error stopping modules:', error);
                }
                
                // Stop scheduler
                try {
                    await scheduler.stop();
                } catch (error) {
                    logger.warn('Error stopping scheduler:', error);
                }
                
                clearTimeout(forceExitTimer);
                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                clearTimeout(forceExitTimer);
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };
        
        // Register shutdown handlers
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Enhanced error handling with cascade protection
        let errorHandlerActive = true;
        let globalErrorCount = 0;
        let lastErrorTime = 0;
        const maxErrorsPerSecond = 10;
        const errorTimeWindow = 1000;
        
        const safeShutdown = async (signal) => {
            if (!errorHandlerActive) {
                console.error(`[${signal}] Error handler disabled, forcing immediate exit`);
                process.exit(1);
            }
            errorHandlerActive = false;
            await shutdown(signal);
        };
        
        // Handle uncaught exceptions with cascade protection
        process.on('uncaughtException', (error) => {
            const now = Date.now();
            
            // Reset counter if outside time window
            if (now - lastErrorTime > errorTimeWindow) {
                globalErrorCount = 0;
            }
            lastErrorTime = now;
            globalErrorCount++;
            
            // Check for error flood
            if (globalErrorCount > maxErrorsPerSecond) {
                console.error('Error cascade detected in uncaught exceptions, forcing exit');
                process.exit(1);
            }
            
            logger.error('Uncaught exception:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                errorCount: globalErrorCount
            });
            
            // Give the system a moment to handle the error before shutdown
            setTimeout(() => {
                if (errorHandlerActive) {
                    safeShutdown('uncaughtException');
                }
            }, 100);
        });
        
        // Enhanced unhandled promise rejection handling
        const rejectionMap = new Map(); // Track rejection sources
        const maxRejectionsPerPromise = 3;
        
        process.on('unhandledRejection', (reason, promise) => {
            const now = Date.now();
            
            // Reset global counter if outside time window
            if (now - lastErrorTime > errorTimeWindow) {
                globalErrorCount = 0;
            }
            lastErrorTime = now;
            globalErrorCount++;
            
            // Track rejections per promise
            const promiseKey = promise.toString();
            const rejectionCount = rejectionMap.get(promiseKey) || 0;
            rejectionMap.set(promiseKey, rejectionCount + 1);
            
            // Check for error flood or repeated rejections
            if (globalErrorCount > maxErrorsPerSecond || rejectionCount > maxRejectionsPerPromise) {
                console.error('Promise rejection cascade detected, forcing exit');
                process.exit(1);
            }
            
            // Clean up old rejection tracking
            if (rejectionMap.size > 100) {
                const keysToDelete = [];
                for (const [key, count] of rejectionMap.entries()) {
                    if (count === 1 && Math.random() < 0.1) { // Randomly clean up single rejections
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(key => rejectionMap.delete(key));
            }
            
            const errorInfo = {
                reason: reason instanceof Error ? {
                    message: reason.message,
                    stack: reason.stack,
                    code: reason.code
                } : reason,
                promiseString: promiseKey.substring(0, 200), // Truncate long promise strings
                errorCount: globalErrorCount,
                rejectionCount: rejectionCount + 1
            };
            
            logger.error('Unhandled rejection:', errorInfo);
            
            // Add promise rejection handler to prevent further unhandled rejections
            promise.catch((error) => {
                logger.warn('Caught previously unhandled promise rejection:', {
                    message: error?.message || error,
                    stack: error?.stack
                });
            });
            
            // For critical rejections, initiate shutdown
            if (rejectionCount > 1 || (reason instanceof Error && reason.message.includes('ECONNREFUSED'))) {
                setTimeout(() => {
                    if (errorHandlerActive) {
                        safeShutdown('unhandledRejection');
                    }
                }, 100);
            }
        });
        
        // Handle promise rejections that are handled later
        process.on('rejectionHandled', (promise) => {
            logger.info('Promise rejection was handled:', {
                promiseString: promise.toString().substring(0, 200)
            });
            
            // Remove from tracking since it's now handled
            const promiseKey = promise.toString();
            rejectionMap.delete(promiseKey);
        });
        
        // Handle warnings with limits
        let warningCount = 0;
        process.on('warning', (warning) => {
            warningCount++;
            
            // Suppress excessive warnings
            if (warningCount > 50) {
                if (warningCount === 51) {
                    logger.warn('Suppressing further warnings due to excessive count');
                }
                return;
            }
            
            logger.warn('Process warning:', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack,
                count: warningCount
            });
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