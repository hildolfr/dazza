import { Command } from '../base.js';

export default new Command({
    name: 'top',
    description: 'Show leaderboards',
    usage: '!top [talkers|bongs|quoted]',
    category: 'stats',
    cooldown: 10000,
    
    async handler(bot, message, args) {
        const category = args[0]?.toLowerCase();
        
        try {
            // If no category specified, show all leaderboards
            if (!category) {
                const talkers = await bot.db.getTopTalkers(3);
                const bongUsers = await bot.db.getTopBongUsers(3);
                const quotables = await bot.db.getTopQuotedUsers(3);
                
                let message = '📊 LEADERBOARDS\n';
                
                // Top talkers
                if (talkers && talkers.length > 0) {
                    message += '🏆 Shit Talkers: ';
                    message += talkers.map((u, i) => `${i+1}. -${u.username} (${u.message_count})`).join(' | ');
                }
                
                // Top bong users
                if (bongUsers && bongUsers.length > 0) {
                    message += '\n🌿 Cone Punchers: ';
                    message += bongUsers.map((u, i) => `${i+1}. -${u.username} (${u.bong_count})`).join(' | ');
                }
                
                // Top quotables
                if (quotables && quotables.length > 0) {
                    message += '\n💬 Quotable Legends: ';
                    message += quotables.map((u, i) => `${i+1}. -${u.username} (${u.quotable_messages})`).join(' | ');
                }
                
                bot.sendMessage(message);
                return { success: true };
            }
            
            let results;
            let title;
            
            switch (category) {
                case 'talkers':
                case 'talker':
                    results = await bot.db.getTopTalkers(5);
                    title = 'Biggest gobs in here';
                    break;
                    
                case 'bongs':
                case 'bong':
                    results = await bot.db.getTopBongUsers(5);
                    title = 'Cooked cunts leaderboard';
                    break;
                    
                case 'quoted':
                case 'quotes':
                    results = await bot.db.getTopQuotedUsers(5);
                    title = 'Funniest cunts apparently';
                    break;
                    
                default:
                    bot.sendMessage('!top [talkers|bongs|quoted]');
                    return { success: true };
            }
            
            if (!results || results.length === 0) {
                bot.sendMessage('fuck all data on that one yet');
                return { success: true };
            }
            
            const topList = results.map((r, i) => {
                const count = r.message_count || r.bong_count || r.quotable_messages;
                return `${i + 1}. -${r.username} (${count})`;
            }).join(' | ');
            
            bot.sendMessage(`${title}: ${topList}`);
            
            return { success: true };
        } catch (error) {
            console.error('Top command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});