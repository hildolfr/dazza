import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';

// Hardcoded allowed users (case-insensitive)
const ALLOWED_USERS = ['Spazztik', 'hildolfr', 'ilovechinks'];

export default new Command({
    name: 'clear',
    aliases: ['cls', 'clearchat'],
    description: 'Clear the chat after a delay (admin only)',
    usage: '!clear [time] [reason]',
    examples: [
        '!clear - Clear chat after 2 seconds',
        '!clear 5 - Clear chat after 5 seconds', 
        '!clear 10 spam - Clear chat after 10 seconds with reason "spam"',
        '!clear 0 offensive content - Clear chat immediately with reason'
    ],
    category: 'admin',
    persistentCooldown: true, // Use persistent cooldown
    pmAccepted: true, // Works in PM for admins
    
    async handler(bot, message, args) {
        try {
            // Check if user is in hardcoded allowed list (case-insensitive)
            const isAllowed = ALLOWED_USERS.some(user => 
                user.toLowerCase() === message.username.toLowerCase()
            );
            
            if (!isAllowed) {
                const errorMsg = "you're not the boss of me cunt";
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg);
                } else {
                    bot.sendMessage(`${message.username}: ${errorMsg}`);
                }
                return { success: false };
            }
            
            // Check persistent cooldown (5 minutes)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 300000); // 5 minutes
                
                if (!cooldownCheck.allowed) {
                    const minutes = Math.floor(cooldownCheck.remaining / 60);
                    const seconds = cooldownCheck.remaining % 60;
                    
                    const cooldownMsg = `oi -${message.username}, ya just cleared chat. wait ${minutes}m ${seconds}s before doin' it again`;
                    
                    if (message.isPM) {
                        bot.sendPrivateMessage(message.username, cooldownMsg);
                    } else {
                        bot.sendMessage(cooldownMsg);
                    }
                    return { success: false };
                }
            }
            
            // Default delay is 2 seconds
            let delay = 2;
            let reason = null;
            
            // Parse arguments
            if (args.length > 0) {
                const timeArg = args[0];
                const parsedTime = parseFloat(timeArg);
                
                // Check if first arg is a number
                if (isNaN(parsedTime)) {
                    // First arg is not a number - error
                    const errorMsg = "that's not a fuckin' number ya drongo";
                    if (message.isPM) {
                        bot.sendPrivateMessage(message.username, errorMsg);
                    } else {
                        bot.sendMessage(`${message.username}: ${errorMsg}`);
                    }
                    return { success: false };
                } else {
                    // Validate time
                    if (parsedTime < 0) {
                        const errorMsg = "mate ya can't go back in time, use a positive number ya numpty";
                        if (message.isPM) {
                            bot.sendPrivateMessage(message.username, errorMsg);
                        } else {
                            bot.sendMessage(`${message.username}: ${errorMsg}`);
                        }
                        return { success: false };
                    }
                    
                    if (parsedTime > 60) {
                        const errorMsg = "fuck off, I'm not waitin' more than a minute. 60 seconds max";
                        if (message.isPM) {
                            bot.sendPrivateMessage(message.username, errorMsg);
                        } else {
                            bot.sendMessage(`${message.username}: ${errorMsg}`);
                        }
                        return { success: false };
                    }
                    
                    delay = parsedTime;
                    // Rest of args are the reason
                    if (args.length > 1) {
                        reason = args.slice(1).join(' ');
                    }
                }
            }
            
            // Convert delay to milliseconds
            const delayMs = delay * 1000;
            
            // Acknowledge the command
            const ackMessage = reason ? 
                `righto ${message.username}, clearin' chat in ${delay} seconds with reason: ${reason}` :
                `alright ${message.username}, clearin' chat in ${delay} seconds`;
                
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, ackMessage);
            } else {
                bot.sendMessage(ackMessage);
            }
            
            // Schedule the clear
            setTimeout(async () => {
                // Send the /clear command
                bot.sendMessage('/clear');
                
                // If there's a reason, announce it after clearing
                if (reason) {
                    // Wait a tiny bit to ensure clear happens first
                    setTimeout(() => {
                        bot.sendMessage(`Oi, chat got wiped by -${message.username}: ${reason}`);
                    }, 100);
                }
            }, delayMs);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Clear command error:', error);
            const errorMsg = 'somethin went wrong with the clear mate';
            
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, errorMsg);
            } else {
                bot.sendMessage(`${message.username}: ${errorMsg}`);
            }
            
            return { success: false };
        }
    }
});