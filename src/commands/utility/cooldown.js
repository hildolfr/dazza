import { Command } from '../base.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'cooldown',
    aliases: ['cooldowns', 'cd'],
    description: 'Check your current command cooldowns',
    usage: '!cooldown',
    category: 'utility',
    cooldown: 2000,
    cooldownMessage: 'steady on, wait {time}s to check cooldowns again',
    pmAccepted: true,
    pmResponses: true, // Always send response as PM
    
    async handler(bot, message, args) {
        try {
            const username = message.username;
            const now = Date.now();
            const activeCooldowns = [];
            
            // Get all commands and check their cooldowns
            for (const [cmdName, command] of bot.commands.commands) {
                // Skip the cooldown command itself
                if (cmdName === 'cooldown') continue;
                
                // Skip commands with persistent cooldowns (they're handled below)
                if (command.persistentCooldown) continue;
                
                const cooldownKey = `${command.name}:${username}`;
                const lastUsed = bot.cooldowns.cooldowns.get(cooldownKey);
                
                if (lastUsed) {
                    const elapsed = now - lastUsed;
                    const remaining = command.cooldown - elapsed;
                    
                    if (remaining > 0) {
                        activeCooldowns.push({
                            command: command.name,
                            remaining: Math.ceil(remaining / 1000),
                            total: Math.ceil(command.cooldown / 1000)
                        });
                    }
                }
            }
            
            // Check persistent cooldowns from the general cooldowns table
            try {
                const persistentCooldowns = await bot.db.all(
                    'SELECT command_name, last_used FROM cooldowns WHERE LOWER(username) = LOWER(?)',
                    [username]
                );
                
                for (const pc of persistentCooldowns) {
                    const command = bot.commands.commands.get(pc.command_name);
                    if (!command) continue;
                    
                    // Determine cooldown duration for each command
                    let cooldownDuration = command.cooldown;
                    
                    // Special durations for specific commands with persistent cooldowns
                    const specialDurations = {
                        'mug': 7200000,           // 2 hours
                        'beg': 172800000,         // 48 hours
                        'couch_coins': 43200000,  // 12 hours
                        'bottles': 86400000,      // 24 hours
                        'cashie': 43200000,       // 12 hours
                        'mystery_esky': 300000,    // 5 minutes
                        'sign_spinning': 129600000, // 36 hours
                        'fish': 7200000,          // 2 hours
                        'tab': 7200000,           // 2 hours
                        'centrelink': 86400000    // 24 hours
                    };
                    
                    if (specialDurations[pc.command_name]) {
                        cooldownDuration = specialDurations[pc.command_name];
                    }
                    
                    const elapsed = now - pc.last_used;
                    const remaining = cooldownDuration - elapsed;
                    
                    if (remaining > 0) {
                        activeCooldowns.push({
                            command: pc.command_name,
                            remaining: Math.ceil(remaining / 1000),
                            total: Math.ceil(cooldownDuration / 1000)
                        });
                    }
                }
            } catch (error) {
                bot.logger.error('Error checking persistent cooldowns:', { error: error.message, stack: error.stack });
            }
            
            // Centrelink is now handled in the persistent cooldowns above
            
            // Format the response - concise version
            let response;
            if (activeCooldowns.length === 0) {
                response = '✅ no cooldowns mate!';
            } else {
                // Sort by remaining time
                activeCooldowns.sort((a, b) => a.remaining - b.remaining);
                
                response = '⏰ Cooldowns:\n';
                for (const cd of activeCooldowns) {
                    const days = Math.floor(cd.remaining / 86400);
                    const hours = Math.floor((cd.remaining % 86400) / 3600);
                    const minutes = Math.floor((cd.remaining % 3600) / 60);
                    const seconds = cd.remaining % 60;
                    
                    let timeStr = '';
                    if (days > 0) {
                        timeStr += `${days}d`;
                        if (hours > 0) timeStr += ` ${hours}h`;
                    } else if (hours > 0) {
                        timeStr += `${hours}h`;
                        if (minutes > 0) timeStr += ` ${minutes}m`;
                    } else if (minutes > 0) {
                        timeStr += `${minutes}m`;
                        if (seconds > 0) timeStr += ` ${seconds}s`;
                    } else {
                        timeStr += `${seconds}s`;
                    }
                    
                    response += `❌ ${cd.command}: ${timeStr}\n`;
                }
            }
            
            sendPM(bot, username, response, message);
            
            // If command was sent in public chat, acknowledge it
            if (!message.isPM) {
                bot.sendMessage(message.roomId, `oi ${username}, check ya PMs for cooldown info`);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in cooldown command:', { error: error.message, stack: error.stack });
            sendPM(bot, message.username, 'fucked up checkin ya cooldowns mate', message);
            return { success: false };
        }
    }
});