import { Command } from '../base.js';

export default new Command({
    name: 'channelstats',
    aliases: ['channelstat', 'chanstats'],
    description: 'Channel statistics',
    usage: '!channelstats',
    category: 'stats',
    cooldown: 10000,
    
    async handler(bot, message, args) {
        try {
            const stats = await bot.db.getChannelStats();
            
            const statsMessage = [
                `Channel's fuckin stats:`,
                `${stats.totalMessages} messages yakked`,
                `${stats.totalUsers} different cunts`,
                `${stats.messagesLast24h} messages last day`,
                stats.mostActiveHour !== null ? `peak hour: ${stats.mostActiveHour}:00` : '',
                `${stats.todayBongs} cones punched today`,
                `${stats.totalBongs} total bongs ripped`
            ].filter(s => s).join(' | ');
            
            bot.sendMessage(statsMessage);
            
            return { success: true };
        } catch (error) {
            console.error('Channelstats command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});