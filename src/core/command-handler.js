import path from 'path';
import fs from 'fs';

/**
 * CommandHandler - Centralized command execution system for bot.js
 * Integrates with the new modular architecture while maintaining compatibility
 * with the existing bot.js structure.
 */
export class CommandHandler {
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
     */
    initializeServices() {
        try {
            // Try to get services from bot context or module registry
            if (this.bot.context && this.bot.context.services) {
                this.permissionService = this.bot.context.services.get('permissions');
                this.cooldownService = this.bot.context.services.get('cooldown');
            }
            
            // Use bot's rate limiter if available
            this.rateLimiter = this.bot.rateLimiter;
            
            this.logger.info('CommandHandler initialized with services', {
                permissions: !!this.permissionService,
                cooldowns: !!this.cooldownService,
                rateLimiter: !!this.rateLimiter
            });
        } catch (error) {
            this.logger.warn('Some services not available during CommandHandler initialization', {
                error: error.message
            });
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
     */
    async checkPermissions(commandName, username) {
        if (this.permissionService) {
            try {
                // Use new permissions service
                const hasPermission = await this.permissionService.checkPermission(
                    username, 
                    `command.${commandName}`,
                    { command: commandName }
                );
                
                return {
                    allowed: hasPermission,
                    reason: hasPermission ? 'allowed' : 'insufficient_permissions'
                };
            } catch (error) {
                this.logger.warn('Permission check failed, falling back to legacy', {
                    error: error.message,
                    username,
                    command: commandName
                });
            }
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

export default CommandHandler;