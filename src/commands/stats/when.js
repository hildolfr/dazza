import { Command } from '../base.js';

export default new Command({
    name: 'when',
    aliases: ['whenwill', 'timeuntil'],
    description: 'Check when a video matching search term will play',
    usage: '!when <search term>',
    examples: [
        '!when rickroll',
        '!when "never gonna"',
        '!when Bob (shows when Bob\'s video plays)'
    ],
    category: 'stats',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        try {
            if (args.length === 0) {
                bot.sendMessage('usage: !when <search term>');
                return { success: true };
            }
            
            const searchTerm = args.join(' ').toLowerCase();
            
            // Get current playlist from bot
            const playlist = bot.playlist || [];
            
            // Debug logging removed
            
            if (playlist.length === 0) {
                bot.sendMessage('playlist is empty mate, CyTube might not be sending playlist data');
                return { success: true };
            }
            
            // Get current video info
            const currentVideo = bot.currentMedia;
            let currentPosition = 0;
            let currentRemaining = 0;
            
            if (currentVideo) {
                currentPosition = currentVideo.currentTime || 0;
                currentRemaining = Math.max(0, ((currentVideo.seconds || currentVideo.duration) || 0) - currentPosition);
            }
            
            // Find current video position in playlist
            let currentIndex = -1;
            if (currentVideo) {
                currentIndex = playlist.findIndex(v => 
                    (v.media && v.media.id === currentVideo.id) || 
                    v.uid === currentVideo.uid
                );
            }
            
            // If we can't find current position, start from beginning
            if (currentIndex === -1) {
                currentIndex = 0;
                currentRemaining = 0;
            }
            
            // Search through playlist starting from current/next video
            let totalSeconds = currentRemaining;
            let found = false;
            let foundVideo = null;
            let foundIndex = -1;
            
            
            // Start searching from the next video after current
            for (let i = currentIndex + 1; i < playlist.length; i++) {
                const video = playlist[i];
                // CyTube stores title in media.title
                const title = ((video.media && video.media.title) || video.title || '').toLowerCase();
                const queueby = (video.queueby || '').toLowerCase();
                
                
                // Check if search term matches title or username
                if (title.includes(searchTerm) || queueby.includes(searchTerm)) {
                    found = true;
                    foundVideo = video;
                    foundIndex = i;
                    break;
                }
                
                // Add video duration to total
                totalSeconds += ((video.media && video.media.seconds) || video.seconds || 0);
            }
            
            if (!found) {
                // Try more specific responses
                if (searchTerm.length < 3) {
                    bot.sendMessage('search term too short mate, gimme more to work with');
                } else {
                    bot.sendMessage(`couldn't find anything matching "${searchTerm}" in the playlist`);
                }
                return { success: true };
            }
            
            // Format time until video plays
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            let timeStr = '';
            if (hours > 0) {
                timeStr = `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                timeStr = `${minutes}m ${seconds}s`;
            } else {
                timeStr = `${seconds}s`;
            }
            
            // Build response
            let response = '';
            
            // Get title from correct location
            const videoTitle = (foundVideo.media && foundVideo.media.title) || foundVideo.title || 'Unknown';
            
            if (foundIndex === 0 && currentRemaining < 30) {
                response = `"${videoTitle}" is up next in ${timeStr}`;
            } else {
                response = `"${videoTitle}" (added by ${foundVideo.queueby}) plays in ~${timeStr}`;
            }
            
            // Add position info
            if (foundIndex > currentIndex) {
                const positionFromNow = foundIndex - currentIndex;
                response += ` [${positionFromNow} videos away]`;
            }
            
            // Add Dazza's commentary based on wait time
            if (hours > 2) {
                const longWaitComments = [
                    ", fuck that's ages away",
                    ", might as well have a nap",
                    ", plenty of time for a few cones",
                    ", that's a whole slab's worth of waiting"
                ];
                response += longWaitComments[Math.floor(Math.random() * longWaitComments.length)];
            } else if (minutes < 5) {
                const shortWaitComments = [
                    ", coming right up",
                    ", just enough time for a dart",
                    ", hold tight",
                    ", almost there mate"
                ];
                response += shortWaitComments[Math.floor(Math.random() * shortWaitComments.length)];
            }
            
            bot.sendMessage(response);
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in when command:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});