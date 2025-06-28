import { Command } from '../base.js';

export default new Command({
    name: 'criminal',
    aliases: ['record', 'rapsheet', 'crimes'],
    description: 'Check criminal record from heist activities',
    usage: '!criminal [username]',
    examples: [
        '!criminal - Check your own criminal record',
        '!criminal Bob - Check Bob\'s criminal record'
    ],
    category: 'stats',
    users: ['all'],
    cooldown: 5000,

    async handler(bot, message, args) {
        try {
            // Get target user
            let targetUser = message.username;
            if (args.length > 0) {
                targetUser = args[0];
            }

            // Get user economy data
            const userData = await bot.db.get(
                'SELECT * FROM user_economy WHERE username = ?',
                [targetUser]
            );

            if (!userData) {
                bot.sendMessage(`-${targetUser} has no criminal record... yet`);
                return { success: true };
            }

            // Get heist participation stats
            const heistStats = await bot.db.get(`
                SELECT 
                    COUNT(DISTINCT heist_id) as total_heists,
                    COUNT(CASE WHEN h.success = 1 THEN 1 END) as successful_heists,
                    COUNT(CASE WHEN h.success = 0 THEN 1 END) as failed_heists
                FROM heist_participants p
                JOIN heist_events h ON p.heist_id = h.id
                WHERE p.username = ?
            `, [targetUser]);

            // Get crime type breakdown
            const crimeTypes = await bot.db.all(`
                SELECT 
                    h.crime_type,
                    COUNT(*) as count,
                    SUM(CASE WHEN h.success = 1 THEN 1 ELSE 0 END) as successes
                FROM heist_participants p
                JOIN heist_events h ON p.heist_id = h.id
                WHERE p.username = ? AND h.crime_type IS NOT NULL
                GROUP BY h.crime_type
                ORDER BY count DESC
                LIMIT 5
            `, [targetUser]);

            // Get total earnings from heists
            const heistEarnings = await bot.db.get(`
                SELECT 
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                    MAX(amount) as biggest_score
                FROM economy_transactions
                WHERE username = ? AND transaction_type = 'heist'
            `, [targetUser]);

            // Build criminal record - keep it concise
            if (heistStats.total_heists === 0) {
                bot.sendMessage(`-${targetUser} has a clean record (fuckin pussy)`);
                return { success: true };
            }
            
            // Calculate success rate
            const successRate = Math.round((heistStats.successful_heists / heistStats.total_heists) * 100);
            
            // Determine criminal status
            let status;
            if (heistStats.total_heists < 5) {
                status = 'Petty Crim';
            } else if (heistStats.total_heists < 20) {
                status = 'Career Criminal';
            } else if (heistStats.total_heists < 50) {
                status = 'Hardened Crim';
            } else {
                status = 'Criminal Mastermind';
            }

            let record = `-${targetUser}: ${status} | `;
            record += `${heistStats.total_heists} heists (${successRate}% success) | `;
            record += `Trust: ${userData.trust} | `;
            
            // Add earnings if any
            if (heistEarnings.total_earned) {
                record += `Stolen: $${heistEarnings.total_earned}`;
                if (heistEarnings.biggest_score) {
                    record += ` (biggest: $${heistEarnings.biggest_score})`;
                }
            } else {
                record += `Stolen: $0`;
            }

            bot.sendMessage(record);
            return { success: true };
        } catch (error) {
            bot.logger.error('Criminal record command error:', error);
            bot.sendMessage('records room is locked mate');
            return { success: false };
        }
    }
});