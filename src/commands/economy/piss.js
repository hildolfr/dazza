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
    name: 'piss',
    aliases: ['pissing_contest'],
    description: 'Challenge someone to a pissing contest',
    usage: '!piss <amount> [username] OR !piss [username] for bragging rights',
    examples: [
        '!piss 100 - Challenge Dazza for $100',
        '!piss 50 @mate - Challenge mate to a $50 contest',
        '!piss @rival - Bragging rights match (no money)'
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
        
        // Check if this is a response to an existing challenge
        const lowerMsg = message.msg.toLowerCase().trim();
        if (ACCEPT_PHRASES.includes(lowerMsg) || DECLINE_PHRASES.includes(lowerMsg)) {
            // Check if user has a pending challenge
            const challenge = bot.pissingContestManager.findChallengeForUser(message.username);
            if (challenge) {
                if (ACCEPT_PHRASES.includes(lowerMsg)) {
                    const result = await bot.pissingContestManager.acceptChallenge(message.username);
                    if (!result.success) {
                        bot.sendMessage(result.message);
                    }
                    return { success: true };
                } else {
                    const result = await bot.pissingContestManager.declineChallenge(message.username);
                    bot.sendMessage(result.message);
                    return { success: true };
                }
            }
        }
        
        // Parse new challenge
        if (args.length === 0) {
            bot.sendMessage('gotta challenge someone mate - !piss <amount> [username] or !piss [username]');
            return { success: false };
        }
        
        let amount = 0;
        let targetUser = null;
        
        // Check if first arg is a number
        const firstArg = args[0];
        if (!isNaN(parseInt(firstArg))) {
            amount = parseInt(firstArg);
            if (amount < 0) {
                bot.sendMessage('can\'t bet negative money ya drongo');
                return { success: false };
            }
            targetUser = args[1];
        } else {
            // First arg is username, $0 match
            targetUser = firstArg;
        }
        
        // If no target specified, challenge the house (not implemented)
        if (!targetUser) {
            bot.sendMessage('gotta specify who to piss against mate - !piss <amount> <username>');
            return { success: false };
        }
        
        // Clean up username
        targetUser = targetUser.replace('@', '');
        
        // Validate target
        if (targetUser.toLowerCase() === message.username.toLowerCase()) {
            bot.sendMessage('can\'t piss against yaself ya numpty');
            return { success: false };
        }
        
        if (targetUser.toLowerCase() === bot.username.toLowerCase() || targetUser.startsWith('[')) {
            bot.sendMessage('bots don\'t piss mate, challenge a real person');
            return { success: false };
        }
        
        // Create challenge
        const result = await bot.pissingContestManager.createChallenge(
            message.username,
            targetUser,
            amount
        );
        
        if (!result.success) {
            bot.sendMessage(result.message);
            return { success: false };
        }
        
        // Announce challenge
        if (amount > 0) {
            bot.sendMessage(`-${message.username} challenges -${targetUser} to a $${amount} pissing contest! Type 'yes' or 'no' to respond (30s to accept)`);
        } else {
            bot.sendMessage(`-${message.username} challenges -${targetUser} to a pissing contest for bragging rights! Type 'yes' or 'no' to respond (30s to accept)`);
        }
        
        return { success: true };
    }
});