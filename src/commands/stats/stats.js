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
            const stats = await bot.db.getUserStats(targetUser, message.roomId);
            
            if (!stats) {
                bot.sendMessage(message.roomId, `never heard of ${targetUser} mate`);
                return { success: true };
            }
            
            const firstSeenAgo = formatDuration(Date.now() - stats.first_seen);
            const lastSeenAgo = formatDuration(Date.now() - stats.last_seen);
            
            // Get bong count for user in this room
            const bongCount = await bot.db.getUserBongCount(targetUser, message.roomId);
            
            // Array of crude responses that dynamically incorporate stats
            const responses = [
                `${stats.username} been tuggin it here for ${firstSeenAgo}, yakked ${stats.message_count} times between wanks, ripped ${bongCount} cones coz they can't get their dick wet`,
                
                `fuuck me dead ${stats.username}'s been here ${firstSeenAgo} and only yakked ${stats.message_count} times? spend less time rootin ya hand and more time chattin ya drongo`,
                
                `${stats.username} ripped ${bongCount} cones and yakked ${stats.message_count} times - that's ${Math.round(bongCount / Math.max(stats.message_count, 1) * 100) / 100} cones per yak, ya cooked cunt. last seen ${lastSeenAgo} ago prob passed out with ya cock in ya hand`,
                
                `oi ${stats.username}'s stats: ${stats.message_count} messages (weak as piss), ${bongCount} bongs (lightweight), been here ${firstSeenAgo} (virgin energy), last seen ${lastSeenAgo} ago (prob havin a root with their pillow)`,
                
                `${stats.username} - ${stats.message_count} yaks? that's fuck all mate. ${bongCount} cones? amateur hour. been lurkin for ${firstSeenAgo} like a horny teenager at a peep show`,
                
                `bloody hell ${stats.username}'s been here ${firstSeenAgo} and only managed ${stats.message_count} messages? too busy on pornhub were ya? at least ya punched ${bongCount} cones between wank sessions`,
                
                `${stats.username} stats: yakked ${stats.message_count} times (probably all about their blue balls), ${bongCount} bongs (trying to forget they can't get laid), last action ${lastSeenAgo} ago (having a cry wank)`,
                
                `fuckin ${stats.username} been here since ${firstSeenAgo} ago, sent ${stats.message_count} messages while drunk and horny, smoked ${bongCount} cones to cope with being unfuckable`,
                
                `${stats.username} - ${bongCount} cones? lightweight. ${stats.message_count} messages? quiet as a virgin at an orgy. been here ${firstSeenAgo} and still can't pull. tragic`,
                
                `${stats.username} ripped ${bongCount} bongs, sent ${stats.message_count} messages (half were prob dick jokes), been a sad cunt here for ${firstSeenAgo}, last seen ${lastSeenAgo} ago jerkin it to cytube`,
                
                `stats for ${stats.username}: ${stats.message_count} yaks (weak effort ya limp dick), ${bongCount} cones (can't handle ya piss either), ghosted us ${lastSeenAgo} ago prob to have a wank`
            ];
            
            // Pick a random response
            const response = responses[Math.floor(Math.random() * responses.length)];
            bot.sendMessage(message.roomId, response);
            
            return { success: true };
        } catch (error) {
            console.error('Stats command error:', error);
            bot.sendMessage(message.roomId, bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});