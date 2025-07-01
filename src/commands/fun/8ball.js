import { Command } from '../base.js';

export default new Command({
    name: '8ball',
    aliases: ['eightball'],
    description: 'Ask the magic 8 ball',
    usage: '!8ball <question>',
    category: 'fun',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (args.length === 0) {
            bot.sendMessage(message.roomId, 'ask me somethin ya drongo');
            return { success: true };
        }
        
        const responses = [
            'yeah nah for sure mate',
            'nah yeah definitely',
            'ask shazza, she knows everything',
            'mate I\'m too cooked to answer that',
            'yeah that\'s a goer',
            'nah mate, buckley\'s chance',
            'about as likely as me gettin\' off the dole',
            'fuckin\' oath it is',
            'she\'ll be right',
            'no wuckin\' furries mate',
            'does a bear shit in the woods?',
            'is the pope catholic?',
            'more chance of me quittin\' durries',
            'yeah nah maybe after a few cones',
            'ask me after smoko',
            'tell \'im he\'s dreamin\'',
            'not a fuckin chance',
            'computer says no',
            'the spirits are tellin me... fuck all',
            'strewth I dunno',
            'probably but I\'m cooked',
            'fuck knows mate',
            'bloody oath',
            'no wukkas',
            'yeah maybe I dunno',
            'ask me after a cone',
            'dead set mate',
            'you\'re havin\' a laugh',
            'pull the other one',
            'chances are slim to fuck all',
            'magic 8 ball says get fucked',
            'outlook\'s about as good as me credit score',
            'wouldn\'t bet me centrelink payment on it',
            'more likely to see a drop bear',
            'sure as shazza loves her wine',
            'certain as death and taxes mate',
            'nah that\'s cooked',
            'yeah but nah but yeah',
            'crystal ball\'s in the shop',
            'lemme consult me VB can... it says maybe',
            'signs point to durries and sadness'
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        bot.sendMessage(message.roomId, `${message.username}: ${response}`);
        
        return { success: true };
    }
});