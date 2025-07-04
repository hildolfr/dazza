import { Command } from './base.js';

export class CommandRegistry {
    constructor(logger = null) {
        this.commands = new Map();
        this.aliases = new Map();
        this.categories = new Map();
        this.logger = logger || console;
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

        this.logger.debug(`Registered command: ${command.name}`);
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
            if (command.cooldownMessage) {
                const message = command.cooldownMessage.replace('{time}', cooldownCheck.remaining);
                return { 
                    success: false, 
                    error: message
                };
            }
            
            // Array of crude cooldown messages
            const cooldownMessages = [
                `fuckin hell mate that command's still coolin down, ${cooldownCheck.remaining}s left`,
                `slow down speedy, ${cooldownCheck.remaining} seconds left on the clock`,
                `jesus mate, let me catch me breath - ${cooldownCheck.remaining}s`,
                `hold ya horses champion, ${cooldownCheck.remaining} more seconds`,
                `patience of a saint ain't ya? wait ${cooldownCheck.remaining}s`,
                `chill ya beans for another ${cooldownCheck.remaining} seconds`,
                `settle down turbo, ya gotta wait ${cooldownCheck.remaining}s`,
                `cool ya jets speedy gonzales, ${cooldownCheck.remaining}s to go`,
                `keep ya pants on, ${cooldownCheck.remaining} seconds left`,
                `fuck me dead give it ${cooldownCheck.remaining}s will ya`,
                `calm ya tits, ${cooldownCheck.remaining} more seconds`,
                `ease up on the gas pedal, ${cooldownCheck.remaining}s remaining`,
                `ya gotta wait ${cooldownCheck.remaining}s, go have a cone`,
                `${cooldownCheck.remaining}s left, perfect time for a quick wank`,
                `hold ya cock for ${cooldownCheck.remaining} more seconds`,
                `${cooldownCheck.remaining}s to go, smoke a dart while ya wait`,
                `bloody hell wait ${cooldownCheck.remaining}s ya impatient cunt`,
                `${cooldownCheck.remaining} seconds mate, I ain't a fuckin machine`,
                `gimme ${cooldownCheck.remaining}s to recover from that last one`,
                `wait ${cooldownCheck.remaining}s or I'll tell shazza`,
                `${cooldownCheck.remaining}s left, bout as long as I last in bed`,
                `chill for ${cooldownCheck.remaining}s, I'm not ya personal slave`,
                `${cooldownCheck.remaining} seconds left, longer than me attention span`,
                `slow ya roll for ${cooldownCheck.remaining}s dickhead`,
                `${cooldownCheck.remaining}s to go, perfect time to scratch ya balls`
            ];
            
            const message = cooldownMessages[Math.floor(Math.random() * cooldownMessages.length)];
            
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