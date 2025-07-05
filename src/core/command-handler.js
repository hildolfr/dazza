const path = require('path');
const fs = require('fs');

/**
 * CommandHandler - Centralized command execution system for bot.js
 * 
 * ⚠️  DEPRECATED: This is legacy code from the bot.js monolithic architecture.
 * The active command handling is now done via the modular command-handler module.
 * This class remains for transition compatibility only.
 * 
 * For new development, use the modular command-handler module instead.
 */
class CommandHandler {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        
        // Services will be injected when available
        this.permissionService = null;
        this.cooldownService = null;
        this.rateLimiter = null;
        
        // Configuration
        this.config = {
            commandPrefix: '!',
            maxArguments: 50,
            maxCommandLength: 100,
            rateLimitDefault: {
                windowMs: 60000, // 1 minute
                max: 15 // 15 commands per minute
            }
        };
        
        // Initialize services
        this.initializeServices();
    }
    
    /**
     * Initialize modular services if available
     * 
     * ⚠️  DEPRECATED: This legacy service injection is not actively used.
     * The modular system uses its own service registration mechanism.
     */
    initializeServices() {
        try {
            // Warn about deprecated usage
            this.logger.warn('⚠️  DEPRECATED: Legacy CommandHandler is being used. Please migrate to the modular command-handler system.');
            
            // Try to get services from bot context, module registry, or global services
            let servicesFound = false;
            
            // Attempt 1: Bot context services (if available)
            if (this.bot.context && this.bot.context.services) {
                this.permissionService = this.bot.context.services.get('permissions');
                this.cooldownService = this.bot.context.services.get('cooldown');
                servicesFound = true;
            }
            
            // Attempt 2: Module registry (if available)
            if (!servicesFound && this.bot.moduleRegistry) {
                try {
                    this.permissionService = this.bot.moduleRegistry.getService('permissions');
                    this.cooldownService = this.bot.moduleRegistry.getService('cooldown');
                    servicesFound = true;
                } catch (error) {
                    // Module registry doesn't have getService method or services not found
                }
            }
            
            // Attempt 3: Global service registry (if running in modular system)
            if (!servicesFound && global.dazzaServices) {
                this.permissionService = global.dazzaServices.get('permissions');
                this.cooldownService = global.dazzaServices.get('cooldown');
                servicesFound = true;
            }
            
            // Use bot's rate limiter if available
            this.rateLimiter = this.bot.rateLimiter;
            
            this.logger.info('Legacy CommandHandler initialized', {
                permissions: !!this.permissionService,
                cooldowns: !!this.cooldownService,
                rateLimiter: !!this.rateLimiter,
                servicesFound: servicesFound,
                note: 'Consider migrating to modular command-handler system'
            });
            
            // If no services found, warn but continue
            if (!servicesFound) {
                this.logger.warn('No modular services found - legacy command handler will use fallback systems only');
            }
            
        } catch (error) {
            this.logger.warn('Legacy CommandHandler service initialization failed - using fallback systems', {
                error: error.message
            });
            
            // Ensure services are null for safe fallback behavior
            this.permissionService = null;
            this.cooldownService = null;
        }
    }
    
    /**
     * Main command handling method - replaces bot.js handleCommand()
     */
    async handleCommand(data) {
        try {
            // Input validation
            if (!data || !data.msg || !data.username) {
                this.logger.warn('Invalid command data received', { data });
                return;
            }
            
            // Check if message starts with command prefix
            if (!data.msg.startsWith(this.config.commandPrefix)) {
                return;
            }
            
            // Parse command and arguments
            const parts = data.msg.slice(1).split(' ');
            const commandName = parts[0].toLowerCase();
            const args = parts.slice(1);
            
            // Validate command length
            if (commandName.length > this.config.maxCommandLength) {
                this.logger.warn('Command name too long', { 
                    command: commandName, 
                    length: commandName.length 
                });
                return;
            }
            
            // Validate arguments count
            if (args.length > this.config.maxArguments) {
                this.logger.warn('Too many arguments', { 
                    command: commandName, 
                    args: args.length 
                });
                return;
            }
            
            // Check rate limiting
            const rateLimitResult = await this.checkRateLimit(data.username);
            if (!rateLimitResult.allowed) {
                await this.handleRateLimitExceeded(data.username, rateLimitResult);
                return;
            }
            
            // Check permissions
            const permissionResult = await this.checkPermissions(commandName, data.username);
            if (!permissionResult.allowed) {
                await this.handlePermissionDenied(data.username, commandName, permissionResult);
                return;
            }
            
            // Check cooldowns
            const cooldownResult = await this.checkCooldowns(commandName, data.username);
            if (!cooldownResult.allowed) {
                await this.handleCooldownActive(data.username, commandName, cooldownResult);
                return;
            }
            
            // Execute command
            const result = await this.executeCommand(commandName, data, args);
            
            // Handle result
            await this.handleCommandResult(commandName, data, args, result);
            
        } catch (error) {
            this.logger.error('Error in command handling', {
                error: error.message,
                stack: error.stack,
                username: data.username,
                message: data.msg
            });
            
            // Send error response
            this.bot.sendMessage(`${data.username}: Something went wrong processing that command`);
        }
    }
    
    /**
     * Check rate limiting using the new or legacy system
     */
    async checkRateLimit(username) {
        if (this.rateLimiter) {
            // Use existing bot rate limiter
            const result = this.rateLimiter.check(username);
            return {
                allowed: result.allowed,
                resetIn: result.resetIn,
                shouldWarn: result.shouldWarn,
                requests: result.requests,
                limit: result.limit
            };
        }
        
        // Fallback: always allow if no rate limiter
        return { allowed: true };
    }
    
    /**
     * Check permissions using the new permissions service or legacy system
     * 
     * ⚠️  DEPRECATED: This legacy permission checking is not actively used.
     * The modular system handles permissions through the permissions module.
     */
    async checkPermissions(commandName, username) {
        // Attempt to use modular permissions service if available
        if (this.permissionService) {
            try {
                // Use new permissions service
                const hasPermission = await this.permissionService.checkPermission(
                    username, 
                    `command.${commandName}`,
                    { command: commandName }
                );
                
                this.logger.debug('Permission check via modular service', {
                    username,
                    command: commandName,
                    result: hasPermission
                });
                
                return {
                    allowed: hasPermission,
                    reason: hasPermission ? 'allowed' : 'insufficient_permissions'
                };
            } catch (error) {
                this.logger.warn('Modular permission check failed, falling back to legacy', {
                    error: error.message,
                    username,
                    command: commandName
                });
            }
        } else {
            this.logger.debug('No modular permission service available, using legacy fallback', {
                username,
                command: commandName
            });
        }
        
        // Fallback to legacy admin check
        const command = this.bot.commands.get(commandName);
        if (command && command.adminOnly) {
            const isAdmin = await this.bot.isAdmin(username);
            return {
                allowed: isAdmin,
                reason: isAdmin ? 'admin_access' : 'admin_required'
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check cooldowns using the new cooldown service or legacy system
     */
    async checkCooldowns(commandName, username) {
        if (this.cooldownService) {
            try {
                // Use new cooldown service
                const cooldownCheck = await this.cooldownService.checkCooldown(
                    username,
                    `command.${commandName}`,
                    { command: commandName }
                );
                
                return {
                    allowed: cooldownCheck.allowed,
                    remaining: cooldownCheck.remaining,
                    reason: cooldownCheck.allowed ? 'allowed' : 'on_cooldown'
                };
            } catch (error) {
                this.logger.warn('Cooldown check failed, falling back to legacy', {
                    error: error.message,
                    username,
                    command: commandName
                });
            }
        }
        
        // Fallback to legacy cooldown check
        const command = this.bot.commands.get(commandName);
        if (command && command.cooldown && this.bot.cooldowns) {
            const cooldownCheck = this.bot.cooldowns.check(username, commandName);
            return {
                allowed: cooldownCheck.allowed,
                remaining: cooldownCheck.remaining,
                reason: cooldownCheck.allowed ? 'allowed' : 'on_cooldown'
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Execute the command using the existing command registry
     */
    async executeCommand(commandName, data, args) {
        const messageData = {
            username: data.username,
            msg: data.msg,
            time: data.time || Date.now(),
            roomId: this.bot.connection?.roomId || 'fatpizza'
        };
        
        // Use existing command registry
        const result = await this.bot.commands.execute(commandName, this.bot, messageData, args);
        
        return result;
    }
    
    /**
     * Handle rate limit exceeded
     */
    async handleRateLimitExceeded(username, rateLimitResult) {
        const message = `oi ${username} fuckin ease up on the commands ya pelican, give it ${rateLimitResult.resetIn}s`;
        this.bot.sendMessage(message);
        
        this.logger.info('Rate limit exceeded', {
            username,
            resetIn: rateLimitResult.resetIn
        });
    }
    
    /**
     * Handle permission denied
     */
    async handlePermissionDenied(username, commandName, permissionResult) {
        if (permissionResult.reason === 'admin_required') {
            this.bot.sendMessage(`${username}: That command requires admin access`);
        } else {
            this.bot.sendMessage(`${username}: You don't have permission to use that command`);
        }
        
        this.logger.info('Permission denied', {
            username,
            command: commandName,
            reason: permissionResult.reason
        });
    }
    
    /**
     * Handle cooldown active
     */
    async handleCooldownActive(username, commandName, cooldownResult) {
        const remainingSeconds = Math.ceil(cooldownResult.remaining / 1000);
        this.bot.sendMessage(`${username}: Command on cooldown, wait ${remainingSeconds}s`);
        
        this.logger.info('Cooldown active', {
            username,
            command: commandName,
            remaining: cooldownResult.remaining
        });
    }
    
    /**
     * Handle command execution result
     */
    async handleCommandResult(commandName, data, args, result) {
        // Log successful command execution
        if (result.success) {
            this.logger.command(data.username, commandName, args);
            
            // Apply cooldown if using new cooldown service
            if (this.cooldownService) {
                try {
                    await this.cooldownService.applyCooldown(
                        data.username,
                        `command.${commandName}`,
                        { command: commandName }
                    );
                } catch (error) {
                    this.logger.warn('Failed to apply cooldown', {
                        error: error.message,
                        username: data.username,
                        command: commandName
                    });
                }
            }
        }
        
        // Handle command not found
        if (!result.success && result.error === 'Command not found') {
            // Don't respond to unknown commands (matches existing behavior)
            return;
        }
        
        // Handle other errors
        if (!result.success && result.error) {
            this.bot.sendMessage(`${data.username}: ${result.error}`);
        }
    }
    
    /**
     * Get command information
     */
    getCommand(commandName) {
        return this.bot.commands.get(commandName);
    }
    
    /**
     * Get all commands
     */
    getAllCommands() {
        return this.bot.commands.getAll();
    }
    
    /**
     * Refresh services (call after module initialization)
     */
    refreshServices() {
        this.initializeServices();
    }
}

module.exports = CommandHandler;