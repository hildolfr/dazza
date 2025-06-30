import { Command } from '../base.js';

export default new Command({
    name: 'top',
    aliases: ['leaderboard'],
    description: 'Get the leaderboards site',
    usage: '!top',
    category: 'stats',
    cooldown: 2000,
    
    async handler(bot, message, args) {
        const leaderboardUrl = 'https://hildolfr.github.io/dazza/leaderboards/';
        
        // Bogan responses for the PM
        const pmResponses = [
            `oi mate, here's ya bloody leaderboards: ${leaderboardUrl}`,
            `check out who's winnin' at life: ${leaderboardUrl}`,
            `feast ya eyes on this beauty: ${leaderboardUrl}`,
            `scope the legends here mate: ${leaderboardUrl}`,
            `have a squiz at the top dogs: ${leaderboardUrl}`,
            `here's where the real cunts hang: ${leaderboardUrl}`,
            `hall of fame's right here mate: ${leaderboardUrl}`,
            `wanna see who's king shit? ${leaderboardUrl}`,
            `leaderboards sorted, here ya go: ${leaderboardUrl}`,
            `all the stats ya need: ${leaderboardUrl}`
        ];
        
        // Bogan acknowledgments for public chat
        const publicAcks = [
            `oi -${message.username}, check ya PMs mate`,
            `sent ya the goods -${message.username}`,
            `PM'd ya the link -${message.username}`,
            `check ya messages -${message.username}`,
            `sorted, check PMs -${message.username}`,
            `sent it to ya inbox -${message.username}`,
            `PM incoming -${message.username}`,
            `check ya DMs legend -${message.username}`
        ];
        
        try {
            // Pick random responses
            const pmMessage = pmResponses[Math.floor(Math.random() * pmResponses.length)];
            const publicMessage = publicAcks[Math.floor(Math.random() * publicAcks.length)];
            
            // Send PM with the URL
            bot.sendPrivateMessage(message.username, pmMessage);
            
            // If command was used in public chat, acknowledge it
            if (!message.isPM) {
                bot.sendMessage(publicMessage);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Top command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});