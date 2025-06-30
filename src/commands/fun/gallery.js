import { Command } from '../base.js';

export default new Command({
    name: 'gallery',
    aliases: ['pics', 'photos'],
    description: 'Get gallery link or manage gallery lock',
    usage: '!gallery | !gallery lock | !gallery unlock',
    category: 'fun',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const action = args[0]?.toLowerCase();
        
        // Handle lock/unlock commands
        if (action === 'lock' || action === 'unlock') {
            const isLocking = action === 'lock';
            
            try {
                await bot.db.setGalleryLock(message.username, isLocking);
                
                // Emit WebSocket event for real-time update
                if (bot.apiServer) {
                    bot.apiServer.broadcastToTopic('gallery', 
                        isLocking ? 'galleryLocked' : 'galleryUnlocked', 
                        { username: message.username }
                    );
                }
                
                if (isLocking) {
                    bot.sendMessage(`Locked -${message.username}'s gallery tighter than a fish's arsehole! No cunt's deletin' yer pics now!`);
                } else {
                    bot.sendMessage(`Unlocked -${message.username}'s gallery! Any drongo can bin yer pics now, careful mate!`);
                }
                
                return { success: true };
            } catch (error) {
                bot.logger.error('Gallery lock error:', error);
                bot.sendMessage(`Fucked up the lock mechanism, try again later ${message.username}`);
                return { success: false };
            }
        }
        
        // Default behavior - send gallery link
        const galleryUrl = 'https://hildolfr.github.io/dazza/gallery/';
        
        // Send a private message to the user
        bot.sendPrivateMessage(
            message.username,
            `Oi ${message.username}, check out yer fuckin' art collection at: ${galleryUrl} - Updated every few minutes with all the shit you cunts post!`
        );
        
        return { success: true };
    }
});