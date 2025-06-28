import { Command } from '../base.js';

export default new Command({
    name: 'uptime',
    description: 'Show bot uptime',
    usage: '!uptime',
    category: 'basic',
    users: ['hildolfr'],
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const uptime = bot.getUptime();
        bot.sendMessage(`been goin for ${uptime}, need another cone to keep me eyes open`);
        
        return { success: true };
    }
});