import BaseModule from '../../core/BaseModule.js';
import ImageHealthService from './services/ImageHealthService.js';

/**
 * Image Health Checker Module
 * Automated image health monitoring and recovery system
 * Converted from standalone ImageHealthChecker to modular architecture
 */
class ImageHealthCheckerModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'image_health_checker';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['gallery-updater', 'user-management'];
        this.healthService = null;
        
        // Default configuration for image health checking
        this.config = {
            checkInterval: 3600000,         // 1 hour - main health check
            recheckInterval: 10800000,      // 3 hours - initial recheck
            batchSize: 50,                  // images per health check cycle
            minFailureInterval: 300000,     // 5 minutes between failures
            maxFailures: 3,                 // strikes before pruning
            maxRecheckHours: 48,           // when to show gravestone badge
            autoStart: true,                // Auto-start monitoring
            ...context.userConfig          // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create ImageHealthService
        this.healthService = new ImageHealthService(
            this._context,
            this.config,
            this.logger
        );
        
        this.logger.info('Image health checker module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize and start the health service
        await this.healthService.initialize();
        await this.healthService.start();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'imageHealthChecker', 
            service: {
                runHealthCheck: this.healthService.runHealthCheck.bind(this.healthService),
                checkUserImages: this.healthService.checkUserImages.bind(this.healthService),
                recheckImage: this.healthService.recheckImage.bind(this.healthService),
                runRecheckPrunedImages: this.healthService.runRecheckPrunedImages.bind(this.healthService),
                startMonitoring: this.healthService.startMonitoring.bind(this.healthService),
                stopMonitoring: this.healthService.stopMonitoring.bind(this.healthService),
                getStatus: this.healthService.getStatus.bind(this.healthService),
                getChecker: this.healthService.getChecker.bind(this.healthService)
            }
        });
        
        // Subscribe to image-related events
        this.subscribe('user:image:added', this.handleImageAdded.bind(this));
        this.subscribe('gallery:manual:check', this.handleManualCheck.bind(this));
        
        this.logger.info('Image health checker module started');
    }

    async stop() {
        this.logger.info('Image health checker module stopping');
        
        if (this.healthService) {
            await this.healthService.stop();
        }
        
        await super.stop();
    }

    /**
     * Handle user image added events
     * @param {Object} data - Image added event data
     */
    async handleImageAdded(data) {
        if (!data || !data.username || !data.url) {
            return;
        }
        
        try {
            this.logger.debug('User image added, may trigger health check', {
                username: data.username,
                url: data.url
            });
            
            // Schedule a user-specific check after a delay to allow the image to settle
            setTimeout(() => {
                this.healthService.checkUserImages(data.username).catch(error => {
                    this.logger.error('Error checking newly added image', {
                        error: error.message,
                        username: data.username,
                        url: data.url
                    });
                });
            }, 30000); // Wait 30 seconds for the image to be fully available
            
        } catch (error) {
            this.logger.error('Error handling image added event', {
                error: error.message,
                username: data.username,
                url: data.url
            });
        }
    }

    /**
     * Handle manual gallery check requests
     * @param {Object} data - Manual check event data
     */
    async handleManualCheck(data) {
        try {
            this.logger.info('Manual gallery health check requested');
            
            if (data && data.username) {
                // User-specific check
                const result = await this.healthService.checkUserImages(data.username);
                
                // Emit result event
                this.emit('gallery:health:check', {
                    type: 'user_specific',
                    username: data.username,
                    result: result,
                    timestamp: Date.now()
                });
            } else {
                // Full gallery check
                const result = await this.healthService.runHealthCheck();
                
                // Emit result event
                this.emit('gallery:health:check', {
                    type: 'full_check',
                    result: result,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.logger.error('Error handling manual check request', {
                error: error.message,
                username: data?.username
            });
            
            // Emit error event
            this.emit('gallery:health:error', {
                error: error.message,
                username: data?.username,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const healthStatus = this.healthService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.healthService?.ready || false,
            services: {
                healthService: !!this.healthService
            },
            healthStatus: healthStatus,
            config: this.config
        };
    }
}

export default ImageHealthCheckerModule;