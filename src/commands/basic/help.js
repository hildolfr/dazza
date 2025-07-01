import { Command } from '../base.js';

export default new Command({
    name: 'help',
    aliases: ['commands', 'halp'],
    description: 'Show available commands',
    usage: '!help [command]',
    category: 'basic',
    users: ['all'],
    cooldown: 5000,
    pmAccepted: true,
    
    async handler(bot, message, args) {
        const commandName = args[0];
        
        if (commandName) {
            // Show help for specific command
            const command = bot.commands.get(commandName);
            
            if (!command) {
                bot.sendMessage(message.roomId, `fuckin command "${commandName}" doesn't exist mate`);
                return { success: true };
            }
            
            let helpText = `${command.name}: ${command.description}`;
            if (command.usage) helpText += ` | Usage: ${command.usage}`;
            if (command.aliases.length > 0) helpText += ` | Aliases: ${command.aliases.join(', ')}`;
            
            bot.sendMessage(message.roomId, helpText);
        } else {
            // Link to the GitHub-hosted command manual
            const manualUrl = 'https://hildolfr.github.io/dazza/commands.html';
            
            // Send public message with variations
            const publicResponses = [
                `Oi -${message.username}, check ya PMs mate!`,
                `Alright -${message.username}, slidin' into ya DMs with the good stuff`,
                `-${message.username} check your private messages ya drongo`,
                `Sendin' ya the deets privately -${message.username}`,
                `PMing ya the command list -${message.username}`
            ];
            
            const response = publicResponses[Math.floor(Math.random() * publicResponses.length)];
            bot.sendMessage(message.roomId, response);
            
            // Send PM with the manual link
            bot.sendPrivateMessage(message.username, `G'day mate! Here's me full command manual: ${manualUrl} 🍺`);
        }
        
        return { success: true };
    }
});