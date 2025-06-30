import { Command } from '../base.js';

export default new Command({
    name: 'gallery',
    aliases: ['pics', 'photos'],
    description: 'Get a link to your personal image gallery',
    usage: '!gallery',
    category: 'fun',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const galleryUrl = 'https://hildolfr.github.io/dazza/gallery/';
        
        // Send a private message to the user
        bot.sendPrivateMessage(
            message.username,
            `Oi ${message.username}, check out yer fuckin' art collection at: ${galleryUrl} - Updated every few minutes with all the shit you cunts post!`
        );
        
        // Public acknowledgment 
        bot.sendMessage(`Sent -${message.username} a link to their gallery, ya nosy cunts`);
        
        return { success: true };
    }
});