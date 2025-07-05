import BaseModule from '../../core/BaseModule.js';
import ReminderService from './services/ReminderService.js';

/**
 * Reminder System Module
 * Handles automated reminder delivery with periodic checking
 * Extracted from bot.js to provide modular reminder functionality
 */
class ReminderSystemModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'reminder-system';
        this.dependencies = ['core-database'];
        this.optionalDependencies = [];
        this.reminderService = null;
        this.userlist = null;
        this.room = null;
    }

    async init() {
        await super.init();
        
        // Create ReminderService
        this.reminderService = new ReminderService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Reminder System module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the reminder service
        await this.reminderService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'reminderSystem', 
            service: {
                checkReminders: this.reminderService.checkReminders.bind(this.reminderService),
                start: this.startReminderService.bind(this),
                stop: this.stopReminderService.bind(this),
                getStatus: this.reminderService.getStatus.bind(this.reminderService)
            }
        });
        
        // Subscribe to user events for tracking online users
        this.subscribe('user:join', this.handleUserJoin.bind(this));
        this.subscribe('user:leave', this.handleUserLeave.bind(this));
        
        // Subscribe to room context events to get userlist and room references
        this.subscribe('room:context', this.handleRoomContext.bind(this));
        
        this.logger.info('Reminder System module started');
    }

    async stop() {
        this.logger.info('Reminder System module stopping');
        
        if (this.reminderService) {
            this.reminderService.stop();
            this.reminderService.ready = false;
        }
        
        await super.stop();
    }

    /**
     * Handle room context events to get userlist and room references
     * @param {Object} data - Room context data
     */
    handleRoomContext(data) {
        const { userlist, room } = data;
        
        if (userlist && room) {
            this.userlist = userlist;
            this.room = room;
            
            // Start the reminder service if we have the necessary context
            if (this.reminderService && this.reminderService.ready) {
                this.reminderService.start(userlist, room);
            }
        }
    }

    /**
     * Handle user join events
     * @param {Object} data - User join event data
     */
    async handleUserJoin(data) {
        const { username, room } = data;
        
        if (!username || !room) {
            this.logger.warn('Invalid user join data for reminder system', { data });
            return;
        }
        
        try {
            // Emit event for other modules
            this.emit('reminder:user-joined', { username, room });
        } catch (error) {
            this.logger.error('Error handling user join for reminders', {
                error: error.message,
                username
            });
        }
    }

    /**
     * Handle user leave events
     * @param {Object} data - User leave event data
     */
    async handleUserLeave(data) {
        const { username, room } = data;
        
        if (!username || !room) {
            this.logger.warn('Invalid user leave data for reminder system', { data });
            return;
        }
        
        try {
            // Emit event for other modules
            this.emit('reminder:user-left', { username, room });
        } catch (error) {
            this.logger.error('Error handling user leave for reminders', {
                error: error.message,
                username
            });
        }
    }

    /**
     * Start the reminder service with current context
     */
    startReminderService() {
        if (this.reminderService && this.userlist && this.room) {
            this.reminderService.start(this.userlist, this.room);
            this.logger.info('Reminder service started via external call');
        } else {
            this.logger.warn('Cannot start reminder service - missing context', {
                hasService: !!this.reminderService,
                hasUserlist: !!this.userlist,
                hasRoom: !!this.room
            });
        }
    }

    /**
     * Stop the reminder service
     */
    stopReminderService() {
        if (this.reminderService) {
            this.reminderService.stop();
            this.logger.info('Reminder service stopped via external call');
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.reminderService?.ready || false,
            serviceRunning: this.reminderService?.intervalId !== null,
            hasContext: {
                userlist: !!this.userlist,
                room: !!this.room
            },
            services: {
                reminderSystem: !!this.reminderService
            }
        };
    }
}

export default ReminderSystemModule;