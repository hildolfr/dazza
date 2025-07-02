import { Command } from '../base.js';

export default new Command({
    name: 'peak',
    aliases: ['peaks', 'peaktime', 'peaktimes'],
    description: 'Show when the channel is most active',
    usage: '!peak',
    category: 'stats',
    cooldown: 10000, // 10 second cooldown
    
    async handler(bot, message, args) {
        try {
            const now = Date.now();
            const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
            
            // Get user activity data from the past week
            const hourlyActivity = await bot.db.all(`
                SELECT 
                    strftime('%w', datetime(timestamp/1000, 'unixepoch', 'localtime')) as day_of_week,
                    strftime('%H', datetime(timestamp/1000, 'unixepoch', 'localtime')) as hour,
                    COUNT(DISTINCT username) as unique_users,
                    COUNT(*) as total_messages
                FROM messages
                WHERE timestamp >= ?
                AND room_id = ?
                GROUP BY day_of_week, hour
                ORDER BY total_messages DESC
            `, [oneWeekAgo, message.roomId]);
            
            if (hourlyActivity.length === 0) {
                bot.sendMessage(message.roomId, `not enough data to show peak times -${message.username}`);
                return { success: true };
            }
            
            // Get top 3 peak times (more concise)
            const topPeaks = hourlyActivity.slice(0, 3);
            
            // Day names (abbreviated)
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            // Format peak times concisely
            let response = "Peak times (AEST): ";
            
            topPeaks.forEach((peak, index) => {
                const dayName = dayNames[parseInt(peak.day_of_week)];
                const hour = parseInt(peak.hour);
                
                if (index > 0) response += ", ";
                response += `${dayName} ${hour}:00 (${peak.unique_users} users)`;
            });
            
            // Send acknowledgment in public
            const publicResponses = [
                `Checkin' the peak times for ya -${message.username}, PMing the results`,
                `Alright -${message.username}, sending ya the busy hours privately`,
                `-${message.username} check your PMs for the peak times mate`,
                `Slidin' into ya DMs with the peak hours -${message.username}`
            ];
            
            bot.sendMessage(message.roomId, publicResponses[Math.floor(Math.random() * publicResponses.length)]);
            
            // Send actual results via PM
            bot.sendPrivateMessage(message.username, response, message.roomId);
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in peak command:', { error: error.message, stack: error.stack });
            bot.sendMessage(message.roomId, "fucked up checkin' the peak times");
            return { success: false };
        }
    }
});