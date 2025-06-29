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
                GROUP BY day_of_week, hour
                ORDER BY total_messages DESC
            `, [oneWeekAgo]);
            
            if (hourlyActivity.length === 0) {
                bot.sendMessage('not enough data to show peak times mate');
                return { success: true };
            }
            
            // Get top 5 peak times
            const topPeaks = hourlyActivity.slice(0, 5);
            
            // Day names
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            // Format peak times
            let response = "📊 **Peak Activity Times (AEST):**\n";
            
            topPeaks.forEach((peak, index) => {
                const dayName = dayNames[parseInt(peak.day_of_week)];
                const hour = parseInt(peak.hour);
                const timeRange = `${hour}:00-${hour + 1}:00`;
                
                response += `${index + 1}. ${dayName} ${timeRange} - ${peak.unique_users} users active\n`;
            });
            
            // Add overall stats
            const totalUsers = await bot.db.get(`
                SELECT COUNT(DISTINCT username) as total
                FROM messages
                WHERE timestamp >= ?
            `, [oneWeekAgo]);
            
            response += `\nTotal unique users this week: ${totalUsers.total}`;
            
            // Add Dazza's commentary
            const commentary = [
                "\n\nBusiest when everyone's avoidin' work",
                "\n\nPeak bludgin' hours right there",
                "\n\nThat's when the real degenerates show up",
                "\n\nPrime shitpostin' hours",
                "\n\nWhen all the legends are online"
            ];
            
            response += commentary[Math.floor(Math.random() * commentary.length)];
            
            bot.sendMessage(response);
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in peak command:', error);
            bot.sendMessage('fucked up checkin' the peak times');
            return { success: false };
        }
    }
});