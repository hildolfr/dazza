import { Command } from './base.js';

export class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.categories = new Map();
    }

    register(command) {
        if (!(command instanceof Command)) {
            throw new Error('Command must be an instance of Command class');
        }

        this.commands.set(command.name, command);
        
        // Register aliases
        command.aliases.forEach(alias => {
            this.aliases.set(alias, command.name);
        });

        // Group by category
        if (!this.categories.has(command.category)) {
            this.categories.set(command.category, []);
        }
        this.categories.get(command.category).push(command);

        console.log(`Registered command: ${command.name}`);
    }

    get(name) {
        // Check direct command name
        let command = this.commands.get(name);
        
        // Check aliases
        if (!command) {
            const actualName = this.aliases.get(name);
            if (actualName) {
                command = this.commands.get(actualName);
            }
        }

        return command;
    }

    getAll() {
        return Array.from(this.commands.values());
    }

    getByCategory(category) {
        return this.categories.get(category) || [];
    }

    getCategories() {
        return Array.from(this.categories.keys());
    }

    async execute(commandName, bot, message, args) {
        const command = this.get(commandName);
        
        if (!command) {
            return { success: false, error: 'Command not found' };
        }

        // Check cooldown
        const cooldownKey = `${command.name}:${message.username}`;
        const cooldownCheck = bot.cooldowns.check(cooldownKey, command.cooldown);
        
        if (!cooldownCheck.allowed) {
            // Use custom cooldown message if provided, otherwise use default
            const message = command.cooldownMessage 
                ? command.cooldownMessage.replace('{time}', cooldownCheck.remaining)
                : `fuckin hell mate that command's still coolin down, ${cooldownCheck.remaining}s left`;
            
            return { 
                success: false, 
                error: message
            };
        }

        try {
            const result = await command.execute(bot, message, args);
            
            // Ensure we always return a proper result object
            if (typeof result !== 'object' || result === null) {
                return { success: true };
            }
            
            if (!result.hasOwnProperty('success')) {
                result.success = true;
            }
            
            return result;
        } catch (error) {
            bot.logger.error(`Command execution failed: ${commandName}`, {
                error: error.message,
                stack: error.stack,
                user: message.username,
                args: args
            });
            
            return {
                success: false,
                error: 'fuck me dead that command just carked it'
            };
        }
    }
}