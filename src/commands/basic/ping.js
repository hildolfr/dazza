import { Command } from '../base.js';

export default new Command({
    name: 'ping',
    description: 'Check if the bot is responsive',
    usage: '!ping',
    category: 'basic',
    users: ['hildolfr'],
    cooldown: 2000,
    
    async handler(bot, message, args) {
        const responses = [
            "yeah nah yeah I'm here mate",
            "oi what cunt?",
            "fuckin pong or whatever",
            "yeah g'day",
            "whadya want?",
            "I'm awake I'm awake fuckin hell"
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        bot.sendMessage(response);
        
        return { success: true };
    }
});