import { Command } from '../base.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'available',
    aliases: ['ready', 'av'],
    description: 'Check which economy commands are ready to use',
    usage: '!available',
    category: 'utility',
    cooldown: 2000,
    cooldownMessage: 'ease up mate, wait {time}s',
    pmAccepted: true,
    pmResponses: true, // Always send response as PM
    
    async handler(bot, message, args) {
        try {
            const username = message.username;
            const now = Date.now();
            
            // List of all commands with persistent cooldowns
            const commandsToCheck = [
                { name: 'mug', duration: 7200000 },           // 2 hours
                { name: 'beg', duration: 172800000 },         // 48 hours
                { name: 'couch_coins', duration: 43200000 },  // 12 hours
                { name: 'bottles', duration: 86400000 },      // 24 hours
                { name: 'cashie', duration: 43200000 },       // 12 hours
                { name: 'mystery_esky', duration: 300000 },    // 5 minutes
                { name: 'sign_spinning', duration: 129600000 }, // 36 hours
                { name: 'fish', duration: 7200000 },          // 2 hours
                { name: 'tab', duration: 7200000 },           // 2 hours
                { name: 'centrelink', duration: 86400000 }    // 24 hours (special case)
            ];
            
            const availableCommands = [];
            
            // Check each command
            for (const cmd of commandsToCheck) {
                const command = bot.commands.commands.get(cmd.name);
                if (!command) continue;
                
                let isAvailable = true;
                
                // Check persistent cooldowns table for all commands including centrelink
                try {
                    const result = await bot.db.get(
                        'SELECT last_used FROM cooldowns WHERE command_name = ? AND LOWER(username) = LOWER(?)',
                        [cmd.name, username]
                    );
                    if (result) {
                        const elapsed = now - result.last_used;
                        isAvailable = elapsed >= cmd.duration;
                    }
                } catch (error) {
                    // If error, assume available
                }
                
                if (isAvailable) {
                    availableCommands.push(cmd.name);
                }
            }
            
            // Format response
            let response;
            if (availableCommands.length === 0) {
                response = '❌ no economy commands ready mate';
            } else {
                response = '💰 Ready to go:\n';
                for (const cmd of availableCommands) {
                    response += `✅ !${cmd}\n`;
                }
            }
            
            sendPM(bot, username, response, message);
            
            // If command was sent in public chat, acknowledge it
            if (!message.isPM) {
                bot.sendMessage(message.roomId, `checkin what's ready for ${username}...`);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in available command:', error);
            sendPM(bot, message.username, 'fucked up checkin ya available commands', message);
            return { success: false };
        }
    }
});