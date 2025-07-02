import { Command } from '../base.js';

// Accept/decline phrases
const ACCEPT_PHRASES = [
    'yes', 'yeah', 'yep', 'sure', 'ok', 'okay',
    'bring it on', 'you\'re on', 'let\'s go', 'fuck yeah',
    'whip it out', 'dicks out', 'let\'s piss',
    'prepare to lose', 'easy money', 'bet'
];

const DECLINE_PHRASES = [
    'no', 'nah', 'nope', 'pass',
    'fuck off', 'piss off', 'not now',
    'maybe later', 'busy', 'can\'t'
];

export default new Command({
    name: 'pissing_contest',
    aliases: ['piss'],
    description: 'Challenge someone to a pissing contest',
    usage: '!pissing_contest <amount> [username] OR !pissing_contest [username] for bragging rights',
    examples: [
        '!pissing_contest 100 - Challenge Dazza for $100',
        '!pissing_contest 50 mate - Challenge mate to a $50 contest',
        '!pissing_contest rival - Bragging rights match (no money)'
    ],
    category: 'economy',
    cooldown: 3000,
    cooldownMessage: 'still zippin up from the last request mate, wait {time}s',
    
    async handler(bot, message, args) {
        // Initialize pissing contest manager if needed
        if (!bot.pissingContestManager) {
            return {
                success: false,
                error: 'pissing contest ain\'t ready yet mate'
            };
        }
        
        // Note: Challenge responses (yes/no) are now handled directly in bot.js
        
        // Parse new challenge
        if (args.length === 0) {
            bot.sendMessage(message.roomId, 'gotta challenge someone mate - !piss <amount> [username] or !piss [username]');
            return { success: false };
        }
        
        let amount = 0;
        let targetUser = null;
        
        // Check if first arg is a number
        const firstArg = args[0];
        if (!isNaN(parseInt(firstArg))) {
            amount = parseInt(firstArg);
            if (amount < 0) {
                bot.sendMessage(message.roomId, 'can\'t bet negative money ya drongo');
                return { success: false };
            }
            targetUser = args[1];
        } else {
            // First arg is username, $0 match
            targetUser = firstArg;
        }
        
        // If no target specified, challenge the house (not implemented)
        if (!targetUser) {
            bot.sendMessage(message.roomId, 'gotta specify who to piss against mate - !piss <amount> <username>');
            return { success: false };
        }
        
        // Clean up username
        targetUser = targetUser.replace('@', '');
        
        // Validate target
        if (targetUser.toLowerCase() === message.username.toLowerCase()) {
            bot.sendMessage(message.roomId, 'can\'t piss against yaself ya numpty');
            return { success: false };
        }
        
        if (targetUser.toLowerCase() === bot.username.toLowerCase() || targetUser.startsWith('[')) {
            bot.sendMessage(message.roomId, 'bots don\'t piss mate, challenge a real person');
            return { success: false };
        }
        
        // Create challenge
        const result = await bot.pissingContestManager.createChallenge(
            message.username,
            targetUser,
            amount,
            message.roomId
        );
        
        if (!result.success) {
            bot.sendMessage(message.roomId, result.message);
            return { success: false };
        }
        
        // Announce challenge
        if (amount > 0) {
            bot.sendMessage(message.roomId, `-${message.username} challenges -${targetUser} to a $${amount} pissing contest! Type 'yes' or 'no' to respond (30s to accept)`);
        } else {
            bot.sendMessage(message.roomId, `-${message.username} challenges -${targetUser} to a pissing contest for bragging rights! Type 'yes' or 'no' to respond (30s to accept)`);
        }
        
        return { success: true };
    }
});