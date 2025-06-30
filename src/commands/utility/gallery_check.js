import { Command } from '../base.js';

export default new Command({
    name: 'gallery_check',
    aliases: ['gcheck', 'checkgallery'],
    description: 'Check and clean dead images from a user\'s gallery',
    usage: '!gallery_check [username]',
    category: 'utility',
    cooldown: 30000, // 30 second cooldown
    
    async handler(bot, message, args) {
        const targetUser = args[0] || message.username;
        
        bot.sendMessage(`Alright mate, checkin' ${targetUser === message.username ? 'yer' : `-${targetUser}'s`} gallery for carked images...`);
        
        try {
            const result = await bot.imageHealthChecker.checkUserImages(targetUser);
            
            if (result.checked === 0) {
                bot.sendMessage(`${targetUser === message.username ? 'Ya' : `-${targetUser}`} got no images in the gallery, ya drongo!`);
                return { success: true };
            }
            
            if (result.dead === 0) {
                bot.sendMessage(`Checked ${result.checked} images for ${targetUser === message.username ? 'ya' : `-${targetUser}`}, all still kickin'!`);
            } else {
                bot.sendMessage(`Oi, checked ${result.checked} images and found ${result.dead} carked ones. Binned 'em like last night's empties!`);
                
                // Emit event for API
                if (bot.apiServer) {
                    bot.emit('gallery:cleanup', {
                        username: targetUser,
                        checked: result.checked,
                        dead: result.dead,
                        timestamp: Date.now()
                    });
                }
            }
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Gallery check error:', error);
            bot.sendMessage(`Fucked up checkin' the gallery, try again later`);
            return { success: false };
        }
    }
});