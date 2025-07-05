import BaseModule from '../../core/BaseModule.js';
import GreetingService from './services/GreetingService.js';

/**
 * Greeting System Module
 * Handles user greetings with spam prevention, first-time detection, and cooldown management
 * Extracted from bot.js to provide modular greeting functionality
 */
class GreetingSystemModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'greeting-system';
        this.dependencies = ['core-database', 'user-management'];
        this.optionalDependencies = [];
        this.greetingService = null;
        
        // Default configuration for greeting system
        this.config = {
            enabled: true,                  // Enable/disable greeting system
            minCooldown: 300000,           // 5 minutes minimum between greetings
            maxCooldown: 900000,           // 15 minutes maximum between greetings
            minTypingDelay: 1000,          // 1 second minimum typing delay
            maxTypingDelay: 3000,          // 3 seconds maximum typing delay
            greetingChance: 0.7,           // 70% chance to greet when conditions met
            recentJoinThreshold: 2,        // Max recent joins before suppressing greetings
            recentJoinWindow: 30000,       // 30 seconds window for recent join tracking
            departureTrackingDuration: 120000,  // 2 minutes - don't greet if user left recently
            departureCleanupAge: 3600000,  // 1 hour - clean up old departure times
            botUsername: context.config?.bot?.username,  // Bot's username to avoid self-greetings
            ...context.config?.greeting    // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create GreetingService
        this.greetingService = new GreetingService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Greeting System module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the greeting service
        await this.greetingService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'greetingSystem', 
            service: {
                handleUserJoin: this.greetingService.handleUserJoin.bind(this.greetingService),
                handleUserLeave: this.greetingService.handleUserLeave.bind(this.greetingService),
                shouldGreetUser: this.greetingService.shouldGreetUser.bind(this.greetingService),
                getRandomGreeting: this.greetingService.getRandomGreeting.bind(this.greetingService),
                getRandomGreetingCooldown: this.greetingService.getRandomGreetingCooldown.bind(this.greetingService),
                getStatus: this.greetingService.getStatus.bind(this.greetingService)
            }
        });
        
        // Subscribe to user join and leave events from User Management System
        this.subscribe('user:joined', this.handleUserJoin.bind(this));
        this.subscribe('user:left', this.handleUserLeave.bind(this));
        
        this.logger.info('Greeting System module started');
    }

    async stop() {
        this.logger.info('Greeting System module stopping');
        
        if (this.greetingService) {
            await this.greetingService.cleanup();
        }
        
        await super.stop();
    }

    /**
     * Handle user join events from User Management System
     * @param {Object} data - User join event data
     */
    async handleUserJoin(data) {
        const { username } = data;
        
        if (!username) {
            this.logger.warn('Invalid user join data for greeting', { data });
            return;
        }
        
        try {
            // Create user object for greeting service
            const user = { name: username };
            
            // Create room context for sending messages
            const roomContext = this.createRoomContext();
            
            // Handle the join
            await this.greetingService.handleUserJoin(user, roomContext);
            
            // Emit event for other modules
            this.emit('user:greeted', { username });
            
        } catch (error) {
            this.logger.error('Error handling user join for greeting', {
                error: error.message,
                username
            });
        }
    }

    /**
     * Handle user leave events from User Management System
     * @param {Object} data - User leave event data
     */
    handleUserLeave(data) {
        const { username } = data;
        
        if (!username) {
            this.logger.warn('Invalid user leave data for greeting', { data });
            return;
        }
        
        try {
            // Create user object for greeting service
            const user = { name: username };
            
            // Handle the leave
            this.greetingService.handleUserLeave(user);
            
            // Emit event for other modules
            this.emit('user:departure', { username });
            
        } catch (error) {
            this.logger.error('Error handling user leave for greeting', {
                error: error.message,
                username
            });
        }
    }

    /**
     * Create room context for service integrations
     * @returns {Object} Room context with sendMessage function
     */
    createRoomContext() {
        return {
            sendMessage: (message) => {
                this.emit('bot:send', { message });
            }
        };
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const serviceStatus = this.greetingService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.greetingService?.ready || false,
            services: {
                greetingSystem: !!this.greetingService
            },
            serviceStatus: serviceStatus
        };
    }
}

export default GreetingSystemModule;