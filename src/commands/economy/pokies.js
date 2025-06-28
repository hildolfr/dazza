import { Command } from '../base.js';

export default new Command({
    name: 'pokies',
    aliases: ['slots', 'slot', 'pokie'],
    description: 'Play the pokies (slot machines)',
    usage: '!pokies <amount>',
    examples: [
        '!pokies 10 - Bet $10 on the pokies',
        '!pokies 50 - Bet $50 for bigger wins'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 3000,
    cooldownMessage: 'the pokies are still spinnin\' from ya last go mate, wait {time}s',

    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendMessage('pokies not plugged in yet mate');
                return { success: false };
            }

            if (args.length === 0) {
                bot.sendMessage('gotta bet somethin mate - !pokies <amount>');
                return { success: false };
            }

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1) {
                bot.sendMessage('invalid bet amount ya drongo');
                return { success: false };
            }

            if (amount > 1000) {
                bot.sendMessage('max bet is $1000, this ain\'t crown casino');
                return { success: false };
            }

            const userBalance = await bot.heistManager.getUserBalance(message.username);
            
            if (userBalance.balance < amount) {
                bot.sendMessage(`ya need $${amount} to play mate, you've only got $${userBalance.balance}`);
                return { success: false };
            }

            // Deduct the bet
            await bot.db.run(
                'UPDATE user_economy SET balance = balance - ? WHERE username = ?',
                [amount, message.username]
            );

            // Pokies symbols (adjusted for ~40% RTP / 60% house edge)
            const symbols = ['🍒', '🍺', '💰', '🔔', '7️⃣', '💎', '🎰'];
            const weights = [35, 30, 20, 10, 3, 1.5, 0.5]; // Weights heavily favor low symbols
            
            // Spin the reels
            const getSymbol = () => {
                const totalWeight = weights.reduce((a, b) => a + b, 0);
                let random = Math.random() * totalWeight;
                
                for (let i = 0; i < symbols.length; i++) {
                    if (random < weights[i]) {
                        return symbols[i];
                    }
                    random -= weights[i];
                }
                return symbols[0];
            };

            const reel1 = getSymbol();
            const reel2 = getSymbol();
            const reel3 = getSymbol();

            // Calculate winnings
            let winnings = 0;
            let message_text = `${reel1} | ${reel2} | ${reel3}`;

            // Check for wins (reduced payouts for harsh house edge)
            if (reel1 === reel2 && reel2 === reel3) {
                // Three of a kind (reduced multipliers)
                const symbolIndex = symbols.indexOf(reel1);
                const multipliers = [2, 3, 5, 10, 25, 50, 100]; // Significantly reduced
                winnings = amount * multipliers[symbolIndex];
                
                if (reel1 === '🎰') {
                    message_text += ` - MEGA JACKPOT!!! $${winnings}`;
                } else if (reel1 === '💎' || reel1 === '7️⃣') {
                    message_text += ` - JACKPOT! $${winnings}`;
                } else {
                    message_text += ` - Winner! $${winnings}`;
                }
            } else if (reel1 === reel2 || reel2 === reel3) {
                // Two of a kind - only on first two or last two reels
                const matchedSymbol = reel1 === reel2 ? reel1 : reel2;
                const symbolIndex = symbols.indexOf(matchedSymbol);
                // Much lower payouts for two of a kind
                const multipliers = [0.5, 0.75, 1, 1.5, 2, 3, 5]; 
                winnings = Math.floor(amount * multipliers[symbolIndex]);
                // Only pay if winning more than bet
                if (winnings > amount) {
                    message_text += ` - Two ${matchedSymbol} - $${winnings}`;
                } else {
                    winnings = 0;
                    message_text += ` - Two ${matchedSymbol} - not enough to win`;
                }
            } else {
                // Loss
                const lossMessages = [
                    ' - bugger all mate',
                    ' - house wins again',
                    ' - into the pokies fund',
                    ' - better luck next spin',
                    ' - bloody rigged'
                ];
                message_text += lossMessages[Math.floor(Math.random() * lossMessages.length)];
            }

            // Send the result
            bot.sendMessage(message_text);

            // Update balance if won
            if (winnings > 0) {
                await bot.db.run(
                    'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
                    [winnings, message.username]
                );

                // Track in transactions
                await bot.db.run(
                    'INSERT INTO economy_transactions (username, amount, transaction_type, created_at) VALUES (?, ?, ?, ?)',
                    [message.username, winnings - amount, 'pokies', Date.now()]
                );

                // Announce big wins
                if (winnings >= amount * 50) {
                    setTimeout(() => {
                        bot.sendMessage(`HOLY FUCK -${message.username} JUST HIT THE JACKPOT!`);
                    }, 1000);
                } else if (winnings >= amount * 10) {
                    setTimeout(() => {
                        bot.sendMessage(`big win! -${message.username} is laughin all the way to the bottle-o`);
                    }, 1000);
                }
            } else {
                // Addiction messages for losses
                if (Math.random() < 0.2) {
                    const addictionMessages = [
                        'just one more spin mate...',
                        'i can feel a big win coming',
                        'the machine\'s about to pay out, i can tell',
                        'double or nothing next spin?',
                        'shoulda played the one next to it'
                    ];
                    setTimeout(() => {
                        bot.sendMessage(addictionMessages[Math.floor(Math.random() * addictionMessages.length)]);
                    }, 2000);
                }
            }

            return { success: true };
        } catch (error) {
            bot.logger.error('Pokies command error:', error);
            bot.sendMessage('pokies machine tilted mate');
            return { success: false };
        }
    }
});