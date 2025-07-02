import { Command } from '../base.js';

export default new Command({
    name: 'monitor',
    aliases: ['cashmonitor', 'cm'],
    description: 'Admin command to check cash monitor status',
    usage: '!monitor [force]',
    category: 'admin',
    adminOnly: true,
    cooldown: 1000,
    
    async handler(bot, message, args) {
        try {
            if (!bot.cashMonitor) {
                bot.sendMessage(message.roomId, 'Cash monitor not initialized');
                return { success: false };
            }

            const stats = bot.cashMonitor.getStats();
            
            if (args[0] === 'force') {
                // Force a check
                await bot.cashMonitor.checkForChanges();
                bot.sendMessage(message.roomId, `Forced cash monitor check - tracking ${stats.usersTracked} users, total balance: $${stats.totalBalance}`);
            } else if (args[0] === 'debug') {
                // Toggle debug mode
                const currentDebug = bot.cashMonitor.debugMode;
                bot.cashMonitor.setDebugMode(!currentDebug);
                bot.sendMessage(message.roomId, `Cash monitor debug mode: ${!currentDebug ? 'ENABLED' : 'DISABLED'}`);
            } else {
                // Show status
                const status = stats.isRunning ? 'RUNNING' : 'STOPPED';
                const debugStatus = bot.cashMonitor.debugMode ? ' [DEBUG]' : '';
                bot.sendMessage(message.roomId, `Cash Monitor: ${status}${debugStatus} | Users: ${stats.usersTracked} | Total: $${stats.totalBalance} | Interval: ${stats.interval/1000}s`);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in monitor command:', { error: error.message, stack: error.stack });
            bot.sendMessage(message.roomId, 'fucked up checking the monitor mate');
            return { success: false };
        }
    }
});