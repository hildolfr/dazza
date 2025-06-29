import { Command } from '../base.js';

export default new Command({
    name: 'scratchie',
    aliases: ['scratch', 'scratchies', 'lotto'],
    description: 'Buy a scratch lottery ticket',
    usage: '!scratchie [amount]',
    examples: [
        '!scratchie - Buy a $5 scratchie',
        '!scratchie 20 - Buy a $20 Golden Nugget'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 5000,
    cooldownMessage: 'still scratchin\' the last one with me car keys mate, gimme {time}s',

    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendMessage('economy system not ready yet mate');
                return { success: false };
            }

            const userBalance = await bot.heistManager.getUserBalance(message.username);
            
            // Default $5 scratchie
            let amount = 5;
            if (args.length > 0) {
                amount = parseInt(args[0]);
                if (isNaN(amount) || amount < 5) {
                    bot.sendMessage('minimum scratchie is $5 mate');
                    return { success: false };
                }
                if (amount > 100) {
                    bot.sendMessage('max scratchie is $100, not made of money');
                    return { success: false };
                }
            }

            if (userBalance.balance < amount) {
                bot.sendMessage(`ya need $${amount} for that scratchie mate, you've only got $${userBalance.balance}`);
                return { success: false };
            }

            // Different scratchie types based on price (all with ~40% RTP / 60% house edge)
            let ticketType, odds;
            if (amount <= 5) {
                ticketType = 'Lucky 7s';
                odds = {
                    lose: 0.85,      // 85% lose
                    small: 0.1,      // 10% win 2x
                    medium: 0.03,    // 3% win 5x
                    big: 0.015,      // 1.5% win 10x
                    jackpot: 0.005   // 0.5% win 50x
                };
            } else if (amount <= 20) {
                ticketType = 'Golden Nugget';
                odds = {
                    lose: 0.82,      // 82% lose
                    small: 0.12,     // 12% win 2x
                    medium: 0.04,    // 4% win 5x
                    big: 0.015,      // 1.5% win 20x
                    jackpot: 0.005   // 0.5% win 100x
                };
            } else {
                ticketType = 'Millionaire Dreams';
                odds = {
                    lose: 0.8,       // 80% lose
                    small: 0.15,     // 15% win 1.5x
                    medium: 0.035,   // 3.5% win 3x
                    big: 0.01,       // 1% win 10x
                    jackpot: 0.005   // 0.5% win 200x
                };
            }

            // Deduct the cost using HeistManager for proper username handling
            await bot.heistManager.updateUserEconomy(message.username, -amount, 0);

            // Scratch animation
            bot.sendMessage(`-${message.username} bought a $${amount} "${ticketType}" scratchie... *scratch scratch*`);

            // Determine outcome
            const roll = Math.random();
            let winnings = 0;
            let resultMessage;

            if (roll < odds.lose) {
                // Lost
                const loseMessages = [
                    'fuck all, better luck next time',
                    'nothing, bloody ripoff',
                    'sweet fuck all mate',
                    'donuts, money down the drain',
                    'jack shit, typical'
                ];
                resultMessage = loseMessages[Math.floor(Math.random() * loseMessages.length)];
            } else if (roll < odds.lose + odds.small) {
                // Small win (2x)
                winnings = amount * 2;
                resultMessage = `winner! matched 3 beers, won $${winnings}!`;
            } else if (roll < odds.lose + odds.small + odds.medium) {
                // Medium win (5x or 3x)
                const multiplier = ticketType === 'Millionaire Dreams' ? 3 : 5;
                winnings = amount * multiplier;
                resultMessage = `fuckin beauty! matched 3 bongs, won $${winnings}!`;
            } else if (roll < odds.lose + odds.small + odds.medium + odds.big) {
                // Big win
                const multiplier = ticketType === 'Lucky 7s' ? 10 : 
                                 ticketType === 'Golden Nugget' ? 20 : 10;
                winnings = amount * multiplier;
                resultMessage = `HOLY SHIT! matched 3 VBs, won $${winnings}!`;
            } else {
                // Jackpot!
                const multiplier = ticketType === 'Lucky 7s' ? 50 : 
                                 ticketType === 'Golden Nugget' ? 100 : 200;
                winnings = amount * multiplier;
                resultMessage = `JACKPOT CUNT! matched 3 GOLDEN DAZZAS! WON $${winnings}!!!`;
            }

            // Add winnings if any
            if (winnings > 0) {
                // Use HeistManager for proper username handling
                await bot.heistManager.updateUserEconomy(message.username, winnings, 0);

                // Track in transactions with error handling
                try {
                    await bot.db.run(
                        'INSERT INTO economy_transactions (username, amount, transaction_type, created_at) VALUES (?, ?, ?, ?)',
                        [message.username, winnings - amount, 'scratchie', Date.now()]
                    );
                } catch (error) {
                    bot.logger.error('Failed to log scratchie transaction:', error);
                    // Don't fail the command just because logging failed
                }
            }

            // Announce result with delay
            setTimeout(() => {
                bot.sendMessage(resultMessage);
                
                // Extra message for big wins
                if (winnings >= amount * 10) {
                    setTimeout(() => {
                        bot.sendMessage(`shiiiiit -${message.username} just won ${winnings / amount}x on a scratchie!`);
                    }, 1000);
                }
            }, 2000);

            return { success: true };
        } catch (error) {
            bot.logger.error('Scratchie command error:', error);
            bot.sendMessage('scratchie machine broke mate');
            return { success: false };
        }
    }
});