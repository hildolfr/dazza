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
        
        // Provide command handling capabilities to other modules
        this.eventBus.on('command.register', this.registerCommand.bind(this));
        this.eventBus.on('command.unregister', this.unregisterCommand.bind(this));
        this.eventBus.on('command.reload', this.reloadCommand.bind(this));
        
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
            return;
        }

        // Check rate limiting
        if (!this.checkRateLimit(username)) {
            this.emit('command.ratelimited', { username: username, command: commandName });
            return;
        }

        // Execute command
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
        return {
            logger: this.logger,
            db: this.legacyDb,
            heistManager: this.legacyHeistManager,
            personality: this.legacyPersonality,
            videoPayoutManager: this.legacyVideoPayoutManager,
            room: room,
            cooldowns: this._context.services.get('cooldown') || { check: () => ({ allowed: true }) },
            isAdmin: (username) => {
                // This will need to be provided by a permission module
                // For now, provide a basic implementation
                const permissions = this._context.services.get('permissions');
                return permissions?.isAdmin?.(username) || false;
            },
            sendMessage: (msg) => room.sendMessage(msg),
            sendPM: (username, msg) => room.sendPM(username, msg)
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
        // Legacy adapters are deprecated and no longer needed
        // The modular system provides command execution without these adapters
        this.logger.info('Skipping legacy adapter initialization - using modern modular command system');
        
        // Set adapters to null to maintain compatibility
        this.legacyDb = null;
        this.legacyHeistManager = null;
        this.legacyPersonality = null;
        this.legacyVideoPayoutManager = null;
    }
    
    // ===== Service Refresh =====
    
    refreshServices() {
        // Reinitialize adapters when services change
        this.initializeLegacyAdapters();
        this.logger.info('Services refreshed for command handler');
    }
}

export default CommandHandlerModule;