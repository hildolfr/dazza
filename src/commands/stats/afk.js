import { Command } from '../base.js';

export default new Command({
    name: 'afk',
    aliases: ['afklist', 'whoafk'],
    description: 'Show who is currently AFK',
    usage: '!afk',
    category: 'stats',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const afkUsers = bot.getAFKUsers();
        
        if (afkUsers.length === 0) {
            bot.sendMessage(`nobody's afk mate, everyone's glued to the screen`);
        } else if (afkUsers.length === 1) {
            bot.sendMessage(`just -${afkUsers[0]} is afk right now`);
        } else if (afkUsers.length <= 5) {
            // Prepend - to each username
            const afkList = afkUsers.map(user => `-${user}`).join(', ');
            bot.sendMessage(`these cunts are afk: ${afkList}`);
        } else {
            bot.sendMessage(`${afkUsers.length} people are afk, too many to list ay`);
        }
        
        return { success: true };
    }
});