import { Command } from '../base.js';

export default new Command({
    name: 'memory',
    aliases: ['mem'],
    description: 'Show current memory usage and statistics',
    usage: '!memory [-v|--verbose]',
    category: 'admin',
    users: ['hildolfr'],
    cooldown: 5000,
    
    async handler(bot, message, args) {
        // Check if memory monitor exists
        if (!bot.memoryMonitor) {
            bot.sendMessage(message.roomId, 'memory monitor not running mate');
            return { success: true };
        }
        
        const stats = bot.memoryMonitor.getStats();
        
        if (!stats) {
            bot.sendMessage(message.roomId, 'no memory stats available yet, gimme a sec');
            return { success: true };
        }
        
        // Format the response
        let response = `memory usage: ${stats.current.heapUsedMB}MB / ${stats.current.heapTotalMB}MB heap (${stats.current.heapPercent}%) | `;
        response += `RSS: ${stats.current.rssMB}MB | `;
        response += `external: ${stats.current.externalMB}MB | `;
        response += `trend: ${stats.trend} | `;
        response += `GC: ${stats.gc.count} times`;
        
        // Add warning if memory is high
        if (stats.current.heapPercent > 85) {
            response += ' ⚠️ HIGH MEMORY';
        } else if (stats.current.heapPercent > 95) {
            response += ' 🚨 CRITICAL';
        }
        
        bot.sendMessage(message.roomId, response);
        
        // If verbose flag is set, show more details
        if (args[0] === '-v' || args[0] === '--verbose') {
            setTimeout(() => {
                let details = `peaks: heap ${stats.peak.heapUsedMB}MB, RSS ${stats.peak.rssMB}MB | `;
                details += `avg: heap ${stats.average.heapUsedMB}MB, RSS ${stats.average.rssMB}MB | `;
                details += `uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`;
                
                bot.sendMessage(message.roomId, details);
                
                // Show data structure sizes if any
                if (Object.keys(stats.dataStructures).length > 0) {
                    setTimeout(() => {
                        const sizes = Object.entries(stats.dataStructures)
                            .map(([name, size]) => `${name}: ${size}`)
                            .join(' | ');
                        bot.sendMessage(message.roomId, `data structures: ${sizes}`);
                    }, 1000);
                }
            }, 1000);
        }
        
        return { success: true };
    }
});