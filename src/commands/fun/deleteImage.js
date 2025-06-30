import { Command } from '../base.js';

export default new Command({
    name: 'deleteimage',
    aliases: ['delimg', 'removeimage'],
    description: 'Delete an image from the gallery',
    usage: '!deleteimage <image_url>',
    category: 'fun',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        if (!args[0]) {
            bot.sendMessage(`Oi ${message.username}, gimme the fuckin' URL to delete!`);
            return { success: false };
        }
        
        const urlToDelete = args.join(' ');
        
        try {
            // Get the image details
            const image = await bot.db.get(`
                SELECT username, is_active
                FROM user_images
                WHERE url = ?
            `, [urlToDelete]);
            
            if (!image) {
                bot.sendMessage(`Can't find that pic in the gallery, ${message.username}. Sure that's the right URL?`);
                return { success: false };
            }
            
            if (!image.is_active) {
                bot.sendMessage(`That pic's already in the bin, ${message.username}!`);
                return { success: false };
            }
            
            // Check if the owner's gallery is locked
            const isLocked = await bot.db.isGalleryLocked(image.username);
            
            if (isLocked) {
                bot.sendMessage(`Nah mate, -${image.username}'s gallery is locked up tight! Can't delete their shit!`);
                return { success: false };
            }
            
            // Delete the image
            await bot.db.pruneUserImage(urlToDelete, `Deleted by ${message.username}`);
            
            bot.sendMessage(`Binned that pic from -${image.username}'s gallery! It's in the dead links graveyard now.`);
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Delete image error:', error);
            bot.sendMessage(`Fucked up the deletion, try again later ${message.username}`);
            return { success: false };
        }
    }
});