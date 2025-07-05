import BaseModule from '../../core/BaseModule.js';
import UserManagementService from './services/UserManagementService.js';

/**
 * User Management Module
 * Handles all user-related operations extracted from bot.js:
 * - Userlist management and tracking
 * - User join/leave events with database logging  
 * - AFK status management
 * - User utility functions and API endpoints
 * 
 * This is a foundational module that other modules depend on for user state.
 */
class UserManagementModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'user-management';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['video-payout', 'greeting-system', 'tell-system'];
        this.userManagementService = null;
    }

    async init() {
        await super.init();
        
        // Create UserManagementService
        this.userManagementService = new UserManagementService(
            this._context.services,
            this.config,
            this.logger,
            this.eventBus
        );
        
        this.logger.info('User Management module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the user management service
        await this.userManagementService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'userManagement', 
            service: {
                getUserlist: this.userManagementService.getUserlist.bind(this.userManagementService),
                getUserlistForRoom: this.userManagementService.getUserlistForRoom.bind(this.userManagementService),
                isUserAFK: this.userManagementService.isUserAFK.bind(this.userManagementService),
                getAFKUsers: this.userManagementService.getAFKUsers.bind(this.userManagementService),
                getUserCount: this.userManagementService.getUserCount.bind(this.userManagementService),
                getAFKUserCount: this.userManagementService.getAFKUserCount.bind(this.userManagementService),
                getUser: this.userManagementService.getUser.bind(this.userManagementService),
                isUserOnline: this.userManagementService.isUserOnline.bind(this.userManagementService),
                hasRecentlyDeparted: this.userManagementService.hasRecentlyDeparted.bind(this.userManagementService),
                removeDepartureTracking: this.userManagementService.removeDepartureTracking.bind(this.userManagementService),
                getStatus: this.userManagementService.getStatus.bind(this.userManagementService)
            }
        });
        
        // Subscribe to CyTube events to handle user events
        this.subscribe('userlist', this.handleUserlist.bind(this));
        this.subscribe('addUser', this.handleUserJoin.bind(this));
        this.subscribe('userLeave', this.handleUserLeave.bind(this));
        this.subscribe('setAFK', this.handleAFKUpdate.bind(this));
        
        // Register API routes for user management
        this.registerApiRoutes({
            '/users': this.handleUsersApi.bind(this),
            '/users/count': this.handleUserCountApi.bind(this),
            '/users/afk': this.handleAFKUsersApi.bind(this)
        });
        
        this.logger.info('User Management module started');
    }

    async stop() {
        this.logger.info('User Management module stopping');
        
        if (this.userManagementService) {
            this.userManagementService.ready = false;
        }
        
        await super.stop();
    }

    /**
     * Handle userlist events from CyTube
     * @param {Object} data - Event data containing users array
     */
    async handleUserlist(data) {
        if (!data || !Array.isArray(data)) {
            this.logger.warn('Invalid userlist data received', { data });
            return;
        }

        try {
            this.userManagementService.handleUserlist(data);
            this.emit('userlist:updated', { userCount: data.length });
        } catch (error) {
            this.logger.error('Error handling userlist event', {
                error: error.message,
                userCount: data?.length
            });
        }
    }

    /**
     * Handle user join events from CyTube
     * @param {Object} data - Event data containing user object
     */
    async handleUserJoin(data) {
        if (!data || !data.name) {
            this.logger.warn('Invalid user join data received', { data });
            return;
        }

        try {
            // Create room context for service integrations
            const roomContext = this.createRoomContext();
            
            await this.userManagementService.handleUserJoin(data, roomContext);
            this.emit('user:joined', { username: data.name });
        } catch (error) {
            this.logger.error('Error handling user join event', {
                error: error.message,
                username: data?.name
            });
            
            this.emit('user:join:error', { 
                username: data?.name, 
                error: error.message 
            });
        }
    }

    /**
     * Handle user leave events from CyTube
     * @param {Object} data - Event data containing user object
     */
    async handleUserLeave(data) {
        if (!data || !data.name) {
            this.logger.warn('Invalid user leave data received', { data });
            return;
        }

        try {
            await this.userManagementService.handleUserLeave(data);
            this.emit('user:left', { username: data.name });
        } catch (error) {
            this.logger.error('Error handling user leave event', {
                error: error.message,
                username: data?.name
            });
            
            this.emit('user:leave:error', { 
                username: data?.name, 
                error: error.message 
            });
        }
    }

    /**
     * Handle AFK status update events from CyTube
     * @param {Object} data - Event data containing name and afk status
     */
    async handleAFKUpdate(data) {
        if (!data || !data.name || typeof data.afk !== 'boolean') {
            this.logger.warn('Invalid AFK update data received', { data });
            return;
        }

        try {
            // Create room context for tell system integration
            const roomContext = this.createRoomContext();
            
            this.userManagementService.handleAFKUpdate(data, roomContext);
            this.emit('user:afk:updated', { 
                username: data.name, 
                afk: data.afk 
            });
        } catch (error) {
            this.logger.error('Error handling AFK update event', {
                error: error.message,
                username: data?.name,
                afk: data?.afk
            });
            
            this.emit('user:afk:error', { 
                username: data?.name, 
                error: error.message 
            });
        }
    }

    /**
     * Create room context for service integrations
     * @returns {Object} Room context with sendMessage and sendPM functions
     */
    createRoomContext() {
        return {
            sendMessage: (message) => {
                this.emit('bot:send', { message });
            },
            sendPM: (username, message) => {
                this.emit('bot:pm', { username, message });
            }
        };
    }

    // ===== API Route Handlers =====

    /**
     * Handle /users API endpoint - get all users
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleUsersApi(req, res) {
        try {
            const userlist = this.userManagementService.getUserlist();
            const users = Array.from(userlist.values()).map(user => ({
                name: user.name,
                afk: user.afk || (user.meta && user.meta.afk) || false,
                rank: user.rank || 0
            }));

            res.json({
                success: true,
                data: {
                    users,
                    count: users.length,
                    afkCount: users.filter(u => u.afk).length
                }
            });
        } catch (error) {
            this.logger.error('Error in users API endpoint', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get users'
            });
        }
    }

    /**
     * Handle /users/count API endpoint - get user counts
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleUserCountApi(req, res) {
        try {
            const totalUsers = this.userManagementService.getUserCount();
            const afkUsers = this.userManagementService.getAFKUserCount();

            res.json({
                success: true,
                data: {
                    total: totalUsers,
                    afk: afkUsers,
                    active: totalUsers - afkUsers
                }
            });
        } catch (error) {
            this.logger.error('Error in user count API endpoint', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get user count'
            });
        }
    }

    /**
     * Handle /users/afk API endpoint - get AFK users
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleAFKUsersApi(req, res) {
        try {
            const afkUsers = this.userManagementService.getAFKUsers();

            res.json({
                success: true,
                data: {
                    users: afkUsers,
                    count: afkUsers.length
                }
            });
        } catch (error) {
            this.logger.error('Error in AFK users API endpoint', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get AFK users'
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} Module status information
     */
    getStatus() {
        const serviceStatus = this.userManagementService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.userManagementService?.ready || false,
            services: {
                userManagement: !!this.userManagementService
            },
            ...serviceStatus
        };
    }
}

export default UserManagementModule;