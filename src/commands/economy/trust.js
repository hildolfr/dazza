import { Command } from '../base.js';

export default new Command({
    name: 'trust',
    aliases: ['rep', 'vouch'],
    description: 'Give trust to another user',
    usage: '!trust <username> <amount>',
    examples: [
        '!trust Bob 5 - Give Bob 5 trust points',
        '!trust dazza 1 - Vouch for dazza'
    ],
    category: 'economy',
    users: ['hildolfr'],
    cooldown: 60000, // 1 minute cooldown to prevent spam

    async handler(bot, message, args) {
        try {
            if (args.length < 2) {
                bot.sendMessage('usage: !trust <username> <amount>');
                return { success: true };
            }

            const targetUser = args[0];
            const amount = parseInt(args[1]);

            // Validate amount
            if (isNaN(amount) || amount < 1 || amount > 5) {
                bot.sendMessage('trust amount must be between 1 and 5 mate');
                return { success: true };
            }

            // Can't trust yourself
            if (targetUser.toLowerCase() === message.username.toLowerCase()) {
                bot.sendMessage('cant vouch for yourself ya drongo');
                return { success: true };
            }

            // Check if HeistManager exists
            if (!bot.heistManager) {
                bot.sendMessage('economy system not ready yet mate');
                return { success: false };
            }

            // Get giver's balance to ensure they have participated
            const giver = await bot.heistManager.getUserBalance(message.username);
            if (giver.trust < 5) {
                bot.sendMessage('need at least 5 trust yourself before you can vouch for others');
                return { success: true };
            }

            // Update trust
            await bot.heistManager.db.run(`
                UPDATE user_economy 
                SET trust = trust + ?, updated_at = ?
                WHERE username = ?
            `, [amount, Date.now(), targetUser]);

            // Record transaction
            await bot.heistManager.db.run(`
                INSERT INTO economy_transactions 
                (username, amount, trust_change, transaction_type, description, created_at)
                VALUES (?, 0, ?, 'trust_gift', ?, ?)
            `, [targetUser, amount, `Trust from ${message.username}`, Date.now()]);

            const responses = [
                `-${message.username} vouched for -${targetUser} (+${amount} trust)`,
                `good lookin out -${message.username}, gave -${targetUser} ${amount} trust`,
                `-${targetUser} got ${amount} trust from -${message.username}`,
                `cheers -${message.username}, -${targetUser}'s a bit more trusted now (+${amount})`
            ];

            bot.sendMessage(responses[Math.floor(Math.random() * responses.length)]);

            return { success: true };
        } catch (error) {
            bot.logger.error('Trust command error:', error);
            bot.sendMessage('failed to update trust, try again later');
            return { success: false };
        }
    }
});