import { Command } from '../Command.js';
import { sendPM } from '../../utils/pmHelper.js';

export default class WorldCommand extends Command {
    constructor() {
        super({
            name: 'world',
            description: 'Get a link to the world map',
            aliases: ['map'],
            category: 'fun',
            cooldown: 0
        });
    }

    async execute(message, args, bot) {
        // Get the base URL from environment or use default
        const baseUrl = process.env.MAP_BASE_URL || 'https://hildolfr.github.io/dazza/world';
        
        // Send PM with the world map link
        await sendPM(bot, message.username, `Check out the world map: ${baseUrl}`, message);
    }
}