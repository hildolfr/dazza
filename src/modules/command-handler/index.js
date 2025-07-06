import BaseModule from '../../core/BaseModule.js';
import CommandLoader from './services/CommandLoader.js';
import CommandRegistry from './services/CommandRegistry.js';
import { Command } from './services/Command.js';

class CommandHandlerModule extends BaseModule {
    constructor(context) {
        super(context);
        this.commandLoader = null;
        this.commandRegistry = null;
        this.rateLimiter = null;
        
        // Legacy adapters for backward compatibility
        this.legacyDb = null;
        this.legacyHeistManager = null;
        this.legacyPersonality = null;
        this.legacyVideoPayoutManager = null;
        this.needsHeistManagerAdapter = false;
        
        this.config = {
            commandPrefix: '!',
            rateLimitWindow: 2000,
            rateLimitMax: 3,
            defaultCooldown: 5000,
            maxArguments: 50,
            maxCommandLength: 100,
            ...context.userConfig
        };
    }

    async init() {
        await super.init();
        
        // Initialize command loader
        this.commandLoader = new CommandLoader(this.logger);
        
        // Load all commands
        this.commandRegistry = await this.commandLoader.loadCommands();
        
        // Initialize rate limiter
        this.rateLimiter = new Map();
        
        // Legacy adapters will be initialized in start() phase
        
        // Subscribe to chat events
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        this.subscribe('chat:pm', this.handlePrivateMessage.bind(this));
        
        this.logger.info('Command handler module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize legacy adapters now that services are available
        this.initializeLegacyAdapters();
        
        // Initialize heist manager adapter if needed
        this.logger.info('=== HEIST MANAGER ADAPTER DEBUG ===', {
            needsAdapter: this.needsHeistManagerAdapter,
            hasHeistService: !!this._context.services.get('heist'),
            hasEconomyService: !!this._context.services.get('economySystem'),
            servicesCount: this._context.services.size
        });
        
        if (this.needsHeistManagerAdapter) {
            try {
                this.logger.info('Attempting to import LegacyHeistManagerAdapter...');
                const { default: LegacyHeistManagerAdapter } = await import('./adapters/LegacyHeistManagerAdapter.js');
                this.logger.info('LegacyHeistManagerAdapter imported successfully');
                
                this.legacyHeistManager = new LegacyHeistManagerAdapter(this._context.services);
                this.legacyHeistManager.setLogger(this.logger);
                
                this.logger.info('=== HEIST MANAGER ADAPTER CREATED ===', {
                    adapterExists: !!this.legacyHeistManager,
                    adapterReady: this.legacyHeistManager?.isReady?.(),
                    servicesPassedToAdapter: this._context.services.size
                });
                
                this.logger.info('Legacy heist manager adapter initialized successfully');
            } catch (error) {
                this.logger.error('Failed to initialize legacy heist manager adapter:', {
                    error: error.message,
                    stack: error.stack
                });
            }
        } else {
            this.logger.info('Heist manager adapter not needed or services not available');
        }
        
        // Provide command handling capabilities to other modules
        this.eventBus.on('command.register', this.registerCommand.bind(this));
        this.eventBus.on('command.unregister', this.unregisterCommand.bind(this));
        this.eventBus.on('command.reload', this.reloadCommand.bind(this));
        
        // Listen for service registrations to reinitialize adapters when economy services become available
        this.eventBus.on('service:register', this.handleServiceRegistration.bind(this));
        
        this.logger.info('Command handler module started');
    }

    async stop() {
        await super.stop();
        
        // Clean up rate limiter
        if (this.rateLimiter) {
            this.rateLimiter.clear();
        }
        
        this.logger.info('Command handler module stopped');
    }

    async handleChatMessage(data) {
        const { message, room, username } = data;
        
        // Check if message starts with command prefix
        if (!message || !message.startsWith(this.config.commandPrefix)) {
            return;
        }

        // Parse command and arguments
        const parts = message.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Validate command length
        if (commandName.length > this.config.maxCommandLength) {
            return;
        }

        // Validate arguments count
        if (args.length > this.config.maxArguments) {
            return;
        }

        // Check rate limiting
        if (!this.checkRateLimit(username)) {
            this.emit('command.ratelimited', { username: username, command: commandName });
            return;
        }

        // Execute command
        await this.executeCommand(commandName, { message, username, room }, args, room);
    }

    async handlePrivateMessage(data) {
        const { message, room, username } = data;
        
        // Check if message starts with command prefix
        if (!message || !message.startsWith(this.config.commandPrefix)) {
            return;
        }

        // Parse command and arguments
        const parts = message.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Get command to check PM acceptance
        const command = this.commandRegistry.get(commandName);
        if (!command || !command.pmAccepted) {
            this.logger.debug('PM command rejected', {
                commandName: commandName,
                commandExists: !!command,
                pmAccepted: command?.pmAccepted
            });
            return;
        }

        // Check rate limiting
        if (!this.checkRateLimit(username)) {
            this.logger.debug('PM command rate limited', { username: username, commandName: commandName });
            this.emit('command.ratelimited', { username: username, command: commandName });
            return;
        }

        // Execute command
        this.logger.debug('Executing PM command', { commandName: commandName, username: username });
        await this.executeCommand(commandName, { message, username, room }, args, room, true);
    }

    async executeCommand(commandName, messageData, args, room, isPrivate = false) {
        const command = this.commandRegistry.get(commandName);
        
        if (!command) {
            this.emit('command.failed', { 
                username: messageData.username, 
                command: commandName, 
                error: 'Command not found' 
            });
            return;
        }

        try {
            // Create bot context for command execution
            const botContext = this.createBotContext(room);
            
            // Execute command
            const result = await this.commandRegistry.execute(commandName, botContext, messageData, args);
            
            if (result.success) {
                this.emit('command.executed', { 
                    username: messageData.username, 
                    command: commandName, 
                    args: args,
                    result: result
                });
                
                // Send response if provided
                if (result.response) {
                    await this.sendResponse(result.response, messageData, room, isPrivate, command);
                }
            } else {
                this.emit('command.failed', { 
                    username: messageData.username, 
                    command: commandName, 
                    error: result.error || 'Unknown error' 
                });
                
                // Send error response
                if (result.error) {
                    await this.sendResponse(result.error, messageData, room, isPrivate, command);
                }
            }
        } catch (error) {
            this.logger.error(`Command execution error: ${commandName}`, {
                error: error.message,
                stack: error.stack,
                user: messageData.username,
                args: args
            });
            
            this.emit('command.failed', { 
                username: messageData.username, 
                command: commandName, 
                error: error.message 
            });
        }
    }

    async sendResponse(response, message, room, isPrivate, command) {
        try {
            // Determine where to send the response
            const sendToPM = isPrivate || (command && command.pmResponses);
            
            if (sendToPM) {
                // Send private message
                await room.sendPM(messageData.username, response);
            } else {
                // Send to chat
                await room.sendMessage(response);
            }
        } catch (error) {
            this.logger.error('Failed to send command response:', error);
        }
    }

    createBotContext(room) {
        // Create a bot context that commands can use
        // This provides access to necessary bot functionality without tight coupling
        const connection = this._context.services.get('connection');
        
        // Debug logging for bot context creation (can be removed in production)
        if (this.logger.level === 'debug') {
            this.logger.debug('Creating bot context', {
                hasLegacyHeistManager: !!this.legacyHeistManager,
                heistManagerReady: this.legacyHeistManager?.isReady?.()
            });
        }
        
        return {
            logger: this.logger,
            db: this.legacyDb,
            heistManager: this.legacyHeistManager,
            personality: this.legacyPersonality,
            videoPayoutManager: this.legacyVideoPayoutManager,
            room: room,
            rooms: connection?.connections || new Map(), // For multi-room fallback
            cooldowns: this._context.services.get('cooldown') || { check: () => ({ allowed: true }) },
            isAdmin: (username) => {
                // This will need to be provided by a permission module
                // For now, provide a basic implementation
                const permissions = this._context.services.get('permissions');
                return permissions?.isAdmin?.(username) || false;
            },
            sendMessage: (msg) => {
                if (room && room.sendMessage) {
                    return room.sendMessage(msg);
                } else if (connection && connection.sendMessage) {
                    return connection.sendMessage(msg);
                } else {
                    this.logger.error('No sendMessage method available');
                }
            },
            sendPM: (username, msg) => {
                if (room && room.sendPrivateMessage) {
                    return room.sendPrivateMessage(username, msg);
                } else if (connection && connection.sendPrivateMessage) {
                    return connection.sendPrivateMessage(username, msg);
                } else {
                    this.logger.error('No sendPrivateMessage method available');
                }
            },
            sendPrivateMessage: (username, msg) => {
                if (room && room.sendPrivateMessage) {
                    return room.sendPrivateMessage(username, msg);
                } else if (connection && connection.sendPrivateMessage) {
                    return connection.sendPrivateMessage(username, msg);
                } else {
                    this.logger.error('No sendPrivateMessage method available');
                }
            }
        };
    }

    checkRateLimit(username) {
        if (!username) {
            this.logger.warn('checkRateLimit called with undefined username');
            return false;
        }
        
        const now = Date.now();
        const userKey = username.toLowerCase();
        
        if (!this.rateLimiter.has(userKey)) {
            this.rateLimiter.set(userKey, []);
        }
        
        const userRequests = this.rateLimiter.get(userKey);
        
        // Remove old requests outside the window
        while (userRequests.length > 0 && (now - userRequests[0]) > this.config.rateLimitWindow) {
            userRequests.shift();
        }
        
        // Check if user has exceeded rate limit
        if (userRequests.length >= this.config.rateLimitMax) {
            return false;
        }
        
        // Add current request
        userRequests.push(now);
        
        return true;
    }

    // Public API methods
    registerCommand(command) {
        if (this.commandRegistry) {
            this.commandRegistry.register(command);
        }
    }

    unregisterCommand(commandName) {
        if (this.commandRegistry) {
            return this.commandRegistry.unregister(commandName);
        }
        return false;
    }

    async reloadCommand(commandName) {
        if (this.commandLoader) {
            return await this.commandLoader.reloadCommand(commandName);
        }
        return false;
    }

    getCommand(name) {
        if (this.commandRegistry) {
            return this.commandRegistry.get(name);
        }
        return null;
    }

    getAllCommands() {
        if (this.commandRegistry) {
            return this.commandRegistry.getAll();
        }
        return [];
    }

    getCommandsByCategory(category) {
        if (this.commandRegistry) {
            return this.commandRegistry.getByCategory(category);
        }
        return [];
    }

    // ===== Legacy Adapter Initialization =====
    
    initializeLegacyAdapters() {
        // Initialize legacy adapters to maintain compatibility with existing commands
        // These adapters bridge the gap between old command interfaces and new modular services
        this.logger.info('Initializing legacy adapters for command compatibility');
        
        // Initialize database adapter
        this.legacyDb = this._context.services.get('database');
        
        // Initialize heist manager adapter
        const heistService = this._context.services.get('heist');
        const economyService = this._context.services.get('economySystem');
        
        if (heistService || economyService) {
            // Create legacy heist manager adapter synchronously
            try {
                // Use dynamic import but await it in start() method instead
                this.needsHeistManagerAdapter = true;
                this.logger.info('Heist manager adapter will be initialized after module start');
            } catch (error) {
                this.logger.error('Failed to prepare legacy heist manager adapter:', error);
            }
        }
        
        // Initialize personality adapter
        this.legacyPersonality = this._context.services.get('personality');
        
        // Initialize video payout manager adapter
        this.legacyVideoPayoutManager = this._context.services.get('video-payout');
    }
    
    // ===== Service Registration Handler =====
    
    async handleServiceRegistration(data) {
        const { name: serviceName } = data;
        
        this.logger.info('=== SERVICE REGISTRATION DETECTED ===', {
            serviceName: serviceName,
            hasHeistManager: !!this.legacyHeistManager
        });
        
        // Check if this is a heist or economy service and we don't have a heist manager yet
        if ((serviceName === 'heist' || serviceName === 'economySystem') && !this.legacyHeistManager) {
            this.logger.info('Economy service registered, attempting to initialize heist manager adapter...');
            
            try {
                const { default: LegacyHeistManagerAdapter } = await import('./adapters/LegacyHeistManagerAdapter.js');
                this.legacyHeistManager = new LegacyHeistManagerAdapter(this._context.services);
                this.legacyHeistManager.setLogger(this.logger);
                
                this.logger.info('=== HEIST MANAGER ADAPTER LATE INIT SUCCESS ===', {
                    adapterExists: !!this.legacyHeistManager,
                    adapterReady: this.legacyHeistManager?.isReady?.(),
                    serviceName: serviceName
                });
            } catch (error) {
                this.logger.error('Failed to late-initialize heist manager adapter:', {
                    error: error.message,
                    serviceName: serviceName
                });
            }
        }
    }
    
    // ===== Service Refresh =====
    
    refreshServices() {
        // Reinitialize adapters when services change
        this.initializeLegacyAdapters();
        this.logger.info('Services refreshed for command handler');
    }
}

export default CommandHandlerModule;