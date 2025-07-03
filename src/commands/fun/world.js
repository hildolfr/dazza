import { Command } from '../base.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'world',
    aliases: ['map'],
    description: 'Get a link to the world map',
    category: 'fun',
    cooldown: 0,
    
    async handler(bot, message, args) {
        // Get the base URL from environment or use default
        const baseUrl = process.env.MAP_BASE_URL || 'https://hildolfr.github.io/dazza/world';
        
        // Dazza-style messages for the PM
        const messages = [
            `oi ${message.username}, check out me town: ${baseUrl}`,
            `have a squiz at dazza's hood mate: ${baseUrl}`,
            `${message.username} ya legend, here's where i live: ${baseUrl}`,
            `fuckin' oath, here's me stompin grounds: ${baseUrl}`,
            `oi ${message.username}, come visit me at the bottlo: ${baseUrl}`
        ];
        
        // Pick a random message
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        // Send PM with the world map link
        await sendPM(bot, message.username, randomMessage, message);
    }
});