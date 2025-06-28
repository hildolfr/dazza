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
            // Link to the GitHub-hosted command manual
            const manualUrl = 'https://hildolfr.github.io/dazza/docs/commands.html';
            
            bot.sendMessage(`Oi mate! Check out me full command manual here: ${manualUrl} 🍺`);
        }
        
        return { success: true };
    }
});