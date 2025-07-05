/**
 * Test script to verify system integration in offline mode
 */

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

async function testOfflineIntegration() {
    console.log('Starting Offline Integration Test');
    console.log('================================');
    
    try {
        // Override config to prevent network connections
        const config = await ConfigManager.load();
        config.rooms = []; // No rooms to prevent connections
        config.modules = {
            'core-database': { enabled: true },
            'core-api': { enabled: false }, // Disable API to prevent port binding
            'core-connection': { enabled: false }, // Disable connections
            'connection-handler': { enabled: false }, // Disable dependent module
            'command-handler': { enabled: true },
            'cooldown': { enabled: true },
            'tell-system': { enabled: true },
            'reminder-system': { enabled: true },
            'memory-management': { enabled: true },
            'message-processing': { enabled: true },
            'bot-message-tracking': { enabled: true },
            'character-personality': { enabled: true },
            'greeting-system': { enabled: true },
            'url-comment': { enabled: true },
            'permissions': { enabled: true },
            'user-management': { enabled: true }
        };
        
        // Create logger
        const logger = await createLogger({ level: 'info', console: true });
        
        // Initialize core components
        logger.info('Initializing core components...');
        const eventBus = new EventBus(config.core?.eventBus);
        const scheduler = new UnifiedScheduler(config.core?.scheduler);
        const performanceMonitor = new PerformanceMonitor(config.core?.performance);
        const errorHandler = new ErrorHandler(config.core?.errorHandler);
        const moduleRegistry = new ModuleRegistry();
        
        // Initialize error handler
        errorHandler.initialize(moduleRegistry, eventBus, logger);
        
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
            roomConnections: new Map(),
            services
        };
        
        // Initialize module loader
        logger.info('Discovering modules...');
        const moduleLoader = new ModuleLoader(context);
        const modules = await moduleLoader.discoverModules();
        
        logger.info(`Found ${modules.length} modules`);
        
        // Filter modules based on config
        const enabledModules = modules.filter(moduleInfo => {
            const enabled = config.modules?.[moduleInfo.name]?.enabled;
            return enabled !== false; // Enable by default unless explicitly disabled
        });
        
        logger.info(`Enabled modules: ${enabledModules.map(m => m.name).join(', ')}`);
        
        // Load and register each enabled module
        for (const moduleInfo of enabledModules) {
            try {
                logger.info(`Loading module: ${moduleInfo.name} v${moduleInfo.manifest.version}`);
                const instance = await moduleLoader.loadModule(moduleInfo);
                
                if (instance) {
                    moduleRegistry.register(
                        moduleInfo.name,
                        instance,
                        moduleInfo.manifest
                    );
                    logger.info(`✓ Registered module: ${moduleInfo.name}`);
                }
            } catch (error) {
                logger.error(`✗ Failed to load module ${moduleInfo.name}:`, error.message);
            }
        }
        
        // Initialize all modules
        logger.info('Initializing modules...');
        await moduleRegistry.initializeModules();
        
        // Start all modules
        logger.info('Starting modules...');
        await moduleRegistry.startModules();
        
        // Test services
        logger.info('Testing registered services...');
        
        const serviceNames = Array.from(services.keys());
        logger.info(`Available services: ${serviceNames.join(', ')}`);
        
        // Test database service
        const dbService = services.get('database');
        if (dbService) {
            logger.info('✓ Database service available');
            // Test a simple query
            const result = await dbService.mainDb.get('SELECT COUNT(*) as count FROM messages');
            logger.info(`✓ Database query successful: ${result.count} messages`);
        }
        
        // Test tell system
        const tellService = services.get('tellSystem');
        if (tellService) {
            logger.info('✓ Tell system service available');
            const status = tellService.getStatus();
            logger.info(`✓ Tell service status: ${JSON.stringify(status)}`);
        }
        
        // Test reminder system
        const reminderService = services.get('reminderSystem');
        if (reminderService) {
            logger.info('✓ Reminder system service available');
            const status = reminderService.getStatus();
            logger.info(`✓ Reminder service status: ${JSON.stringify(status)}`);
        }
        
        // Test memory management
        const memoryService = services.get('memoryManagement');
        if (memoryService) {
            logger.info('✓ Memory management service available');
            const stats = memoryService.getMemoryStats();
            logger.info(`✓ Memory stats: Heap used: ${stats.current.heapUsedMB}MB, RSS: ${stats.current.rssMB}MB`);
        }
        
        // Test command loading
        const commandService = services.get('commandRegistry');
        if (commandService) {
            logger.info('✓ Command registry service available');
            const commands = commandService.getCommands();
            logger.info(`✓ Commands loaded: ${commands.size} commands`);
        }
        
        // Test user management
        const userManagementService = services.get('userManagement');
        if (userManagementService) {
            logger.info('✓ User management service available');
            const status = userManagementService.getStatus();
            logger.info(`✓ User management status: ${JSON.stringify(status)}`);
            const userCount = userManagementService.getUserCount();
            logger.info(`✓ Current user count: ${userCount}`);
        }
        
        // Stop all modules
        logger.info('Stopping modules...');
        await moduleRegistry.stopModules();
        
        // Stop performance monitoring
        performanceMonitor.stopMonitoring();
        
        // Stop scheduler
        await scheduler.stop();
        
        logger.info('🎉 OFFLINE INTEGRATION TEST PASSED!');
        
        return {
            success: true,
            modulesFound: modules.length,
            modulesEnabled: enabledModules.length,
            servicesRegistered: serviceNames.length,
            services: serviceNames
        };
        
    } catch (error) {
        console.error('❌ OFFLINE INTEGRATION TEST FAILED:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test
testOfflineIntegration().then(result => {
    console.log('\n=== TEST RESULTS ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
}).catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
});