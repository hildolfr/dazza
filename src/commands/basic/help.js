import { Command } from '../base.js';

export default new Command({
    name: 'help',
    aliases: ['commands', 'halp'],
    description: 'Show available commands',
    usage: '!help [command]',
    category: 'basic',
    users: ['all'],
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const commandName = args[0];
        
        if (commandName) {
            // Show help for specific command
            const command = bot.commands.get(commandName);
            
            if (!command) {
                bot.sendMessage(`fuckin command "${commandName}" doesn't exist mate`);
                return { success: true };
            }
            
            let helpText = `${command.name}: ${command.description}`;
            if (command.usage) helpText += ` | Usage: ${command.usage}`;
            if (command.aliases.length > 0) helpText += ` | Aliases: ${command.aliases.join(', ')}`;
            
            bot.sendMessage(helpText);
        } else {
            // Show condensed help with actual available commands
            const categories = bot.commands.getCategories();
            const commandList = [];
            
            // Get all enabled commands accessible to this user
            categories.forEach(category => {
                const commands = bot.commands.getByCategory(category);
                commands.forEach(cmd => {
                    if (cmd.enabled && (!cmd.adminOnly || bot.isAdmin(message.username))) {
                        commandList.push(cmd.name);
                    }
                });
            });
            
            // Sort alphabetically for consistency
            commandList.sort();
            
            const helpText = commandList.join(', ');
            
            bot.sendMessage(helpText);
        }
        
        return { success: true };
    }
});