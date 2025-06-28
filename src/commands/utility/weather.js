import { Command } from '../base.js';
import { getWeather } from '../../services/weather.js';

export default new Command({
    name: 'weather',
    aliases: ['w'],
    description: 'Check weather',
    usage: '!weather <location>',
    category: 'utility',
    cooldown: 10000,
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage('weather where ya dropkick?');
            return { success: true };
        }
        
        const location = args.join(' ');
        
        try {
            const weather = await getWeather(location);
            bot.sendMessage(`🌤️ ${location}: ${weather}`);
            return { success: true };
        } catch (error) {
            console.error('Weather error:', error);
            if (error.message === 'Unknown location') {
                bot.sendMessage('never heard of that place mate');
            } else {
                bot.sendMessage('can\'t check the weather right now mate, probably the government');
            }
            return { success: true };
        }
    }
});