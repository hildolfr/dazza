import { Command } from '../base.js';
import { formatDuration, formatTimestamp } from '../../utils/formatting.js';

export default new Command({
    name: 'stats',
    aliases: ['userstats'],
    description: 'Show user statistics',
    usage: '!stats [username]',
    category: 'stats',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const targetUser = args[0] || message.username;
        
        try {
            const stats = await bot.db.getUserStats(targetUser);
            
            if (!stats) {
                bot.sendMessage(`never heard of ${targetUser} mate`);
                return { success: true };
            }
            
            const firstSeenAgo = formatDuration(Date.now() - stats.first_seen);
            const lastSeenAgo = formatDuration(Date.now() - stats.last_seen);
            
            // Get bong count for user
            const bongCount = await bot.db.getUserBongCount(targetUser);
            
            bot.sendMessage(
                `${stats.username} - yakked ${stats.message_count} times, ` +
                `ripped ${bongCount} cones, ` +
                `been here since ${firstSeenAgo} ago, last seen ${lastSeenAgo} ago`
            );
            
            return { success: true };
        } catch (error) {
            console.error('Stats command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});