import { Command } from '../base.js';
import { formatDuration } from '../../utils/formatting.js';

export default new Command({
    name: 'seen',
    description: 'Check when a user was last seen',
    usage: '!seen <username>',
    category: 'stats',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (!args[0]) {
            bot.sendMessage('seen who mate?');
            return { success: true };
        }
        
        const targetUser = args[0];
        
        // Check if user is currently online
        const onlineUser = bot.userlist.get(targetUser.toLowerCase());
        if (onlineUser) {
            bot.sendMessage(`${targetUser}'s right fuckin here ya muppet`);
            return { success: true };
        }
        
        try {
            const stats = await bot.db.getUserStats(targetUser);
            
            if (!stats) {
                bot.sendMessage(`never heard of ${targetUser}`);
                return { success: true };
            }
            
            const lastSeenAgo = formatDuration(Date.now() - stats.last_seen);
            bot.sendMessage(`${stats.username} was last seen ${lastSeenAgo} ago`);
            
            return { success: true };
        } catch (error) {
            console.error('Seen command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});