import { Command } from '../base.js';

export default new Command({
    name: 'coin_flip',
    aliases: ['coinflip', 'flip', 'cf'],
    description: 'Flip a coin against another user or the house',
    usage: '!coin_flip <amount> [@user] OR respond to a challenge with heads/tails',
    examples: [
        '!coin_flip 50 - Flip against Dazza for $50',
        '!coin_flip 100 @mate - Challenge mate to a $100 coin flip',
        'heads - Accept a challenge and choose heads',
        'tails - Accept a challenge and choose tails'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 3000,
    cooldownMessage: 'still flippin\' the last coin mate, wait {time}s',
    pmAccepted: true,

    async handler(bot, message, args) {
        try {
            // Validate required objects exist
            if (!bot || !message || !message.username) {
                bot.logger.error('Coin flip: Invalid bot or message object');
                return { success: false };
            }

            if (!bot.heistManager) {
                const msg = 'coin flip table\'s broken mate';
                bot.sendMessage(msg, message.isPM ? message.username : null);
                return { success: false };
            }

            if (!bot.db) {
                bot.logger.error('Coin flip: Database not available');
                const msg = 'database is cooked mate, try again later';
                bot.sendMessage(msg, message.isPM ? message.username : null);
                return { success: false };
            }

            // Check if this is a response to a challenge (just "heads" or "tails")
            if (args.length === 1 && ['heads', 'tails'].includes(args[0].toLowerCase())) {
                return await this.handleChallengeResponse(bot, message, args[0].toLowerCase());
            }

            // Otherwise it's a new flip
            if (args.length === 0) {
                const msg = 'gotta bet somethin mate - !coin_flip <amount> [username]';
                bot.sendMessage(msg, message.isPM ? message.username : null);
                return { success: false };
            }

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1) {
                const msg = 'invalid bet amount ya drongo';
                bot.sendMessage(msg, message.isPM ? message.username : null);
                return { success: false };
            }

            let userBalance;
            try {
                userBalance = await bot.heistManager.getUserBalance(message.username);
            } catch (balanceError) {
                bot.logger.error('Coin flip: Failed to get user balance', {
                    error: balanceError.message,
                    username: message.username
                });
                const msg = 'couldn\'t check ya balance mate, try again';
                bot.sendMessage(msg, message.isPM ? message.username : null);
                return { success: false };
            }
            
            if (userBalance.balance < amount) {
                const msg = `ya need $${amount} to flip mate, you've only got $${userBalance.balance}`;
                bot.sendMessage(msg, message.isPM ? message.username : null);
                return { success: false };
            }

            // Check if challenging another user
            if (args.length >= 2) {
                // Extract username (remove @ if present)
                const challengedUser = args[1].replace('@', '').toLowerCase();
                
                // Can't challenge yourself
                if (challengedUser === message.username.toLowerCase()) {
                    const msg = 'can\'t flip against yaself ya numpty';
                    bot.sendMessage(msg, message.isPM ? message.username : null);
                    return { success: false };
                }

                // Can't challenge bots
                if (challengedUser === bot.username.toLowerCase() || challengedUser.startsWith('[')) {
                    const msg = 'bots don\'t gamble mate, try a real person';
                    bot.sendMessage(msg, message.isPM ? message.username : null);
                    return { success: false };
                }

                return await this.createChallenge(bot, message, challengedUser, amount);
            } else {
                // Flip against the house
                return await this.flipVsHouse(bot, message, amount);
            }

        } catch (error) {
            bot.logger.error('Coin flip command error:', {
                error: error.message,
                stack: error.stack,
                username: message?.username,
                args: args,
                isPM: message?.isPM
            });
            bot.sendMessage('coin dropped down a drain mate');
            return { success: false };
        }
    },

    async createChallenge(bot, message, challengedUser, amount) {
        let challengeId = null;
        
        try {
            // Use a transaction for atomic operations
            await bot.db.run('BEGIN TRANSACTION');
            
            try {
                // Check if challenger already has a pending challenge
                const existingChallenge = await bot.db.get(
                    'SELECT * FROM coin_flip_challenges WHERE challenger = ? AND status = ?',
                    [message.username, 'pending']
                );

                if (existingChallenge) {
                    await bot.db.run('ROLLBACK');
                    bot.sendMessage('ya already got a challenge pending mate, wait for that one first');
                    return { success: false };
                }

                // Check challenger's balance again with lock
                const challengerBalance = await bot.heistManager.getUserBalance(message.username);
                if (challengerBalance.balance < amount) {
                    await bot.db.run('ROLLBACK');
                    bot.sendMessage(`ya don't have enough money mate, need $${amount} but only got $${challengerBalance.balance}`);
                    return { success: false };
                }

                // Check if challenged user has enough money
                const challengedBalance = await bot.heistManager.getUserBalance(challengedUser);
                if (challengedBalance.balance < amount) {
                    await bot.db.run('ROLLBACK');
                    bot.sendMessage(`-${challengedUser} is too broke for a $${amount} flip (only has $${challengedBalance.balance})`);
                    return { success: false };
                }

                // Deduct bet from challenger - this will fail if balance goes negative
                const deductResult = await bot.db.run(
                    'UPDATE user_economy SET balance = balance - ? WHERE username = ? AND balance >= ?',
                    [amount, message.username, amount]
                );
                
                if (deductResult.changes === 0) {
                    await bot.db.run('ROLLBACK');
                    bot.sendMessage('couldn\'t deduct ya bet mate, try again');
                    return { success: false };
                }

                // Create challenge
                const now = Date.now();
                const expiresAt = now + 30000; // 30 seconds

                const result = await bot.db.run(
                    `INSERT INTO coin_flip_challenges 
                    (challenger, challenged, amount, status, created_at, expires_at) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [message.username, challengedUser, amount, 'pending', now, expiresAt]
                );
                
                challengeId = result.lastID;
                
                // Commit the transaction
                await bot.db.run('COMMIT');

                // Public announcement
                const announcements = [
                    `oi -${challengedUser}! -${message.username} challenges ya to flip for $${amount}! respond with heads or tails in 30 seconds`,
                    `-${message.username} throws down $${amount} for a coin flip! -${challengedUser} ya in? heads or tails mate`,
                    `COIN FLIP CHALLENGE! -${message.username} vs -${challengedUser} for $${amount}! pick heads or tails quick`,
                    `$${amount} on the line! -${message.username} wants to flip against -${challengedUser}! heads or tails?`
                ];

                bot.sendMessage(announcements[Math.floor(Math.random() * announcements.length)]);

                // Set timeout to cancel challenge
                setTimeout(async () => {
                    try {
                        await bot.db.run('BEGIN TRANSACTION');
                        
                        // Check if challenge is still pending
                        const challenge = await bot.db.get(
                            'SELECT * FROM coin_flip_challenges WHERE id = ? AND status = ?',
                            [challengeId, 'pending']
                        );

                        if (challenge) {
                            // Cancel and refund
                            await bot.db.run(
                                'UPDATE coin_flip_challenges SET status = ? WHERE id = ?',
                                ['cancelled', challenge.id]
                            );

                            // Refund the challenger
                            await bot.db.run(
                                'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
                                [amount, message.username]
                            );
                            
                            await bot.db.run('COMMIT');

                            const timeoutMessages = [
                                `-${challengedUser} chickened out! refunding -${message.username}'s $${amount}`,
                                `no response from -${challengedUser}, giving -${message.username} their $${amount} back`,
                                `-${challengedUser} too scared to flip! -${message.username} gets their $${amount} back`,
                                `times up! -${challengedUser} didn't respond, -${message.username} keeps their $${amount}`
                            ];

                            bot.sendMessage(timeoutMessages[Math.floor(Math.random() * timeoutMessages.length)]);
                        } else {
                            await bot.db.run('ROLLBACK');
                        }
                    } catch (error) {
                        bot.logger.error('Error in challenge timeout:', error);
                        try {
                            await bot.db.run('ROLLBACK');
                        } catch {}
                    }
                }, 30000);

                return { success: true };

            } catch (error) {
                await bot.db.run('ROLLBACK');
                throw error;
            }

        } catch (error) {
            bot.logger.error('Error creating coin flip challenge:', error);
            bot.sendMessage('challenge board broke mate');
            return { success: false };
        }
    },

    async handleChallengeResponse(bot, message, choice) {
        try {
            await bot.db.run('BEGIN TRANSACTION');
            
            try {
                // Use UPDATE with WHERE to atomically claim the challenge
                const updateResult = await bot.db.run(
                    `UPDATE coin_flip_challenges 
                    SET status = 'accepting', challenged_choice = ?
                    WHERE challenged = ? AND status = 'pending' AND expires_at > ?`,
                    [choice, message.username, Date.now()]
                );

                // Check if we successfully claimed a challenge
                let challenge = null;
                if (updateResult.changes > 0) {
                    challenge = await bot.db.get(
                        `SELECT * FROM coin_flip_challenges 
                        WHERE challenged = ? AND status = 'accepting' AND challenged_choice = ?`,
                        [message.username, choice]
                    );
                }

                if (!challenge) {
                    await bot.db.run('ROLLBACK');
                    bot.sendMessage('no pending coin flip for ya mate');
                    return { success: false };
                }

                // Check if challenged user has enough money with lock
                const userBalance = await bot.db.get(
                    'SELECT balance FROM user_economy WHERE username = ?',
                    [message.username]
                );
                
                if (!userBalance || userBalance.balance < challenge.amount) {
                    // Cancel challenge and refund
                    await bot.db.run(
                        'UPDATE coin_flip_challenges SET status = ? WHERE id = ?',
                        ['cancelled', challenge.id]
                    );

                    // Refund challenger
                    await bot.db.run(
                        'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
                        [challenge.amount, challenge.challenger]
                    );
                    
                    await bot.db.run('COMMIT');

                    bot.sendMessage(`-${message.username} is too broke now! only has $${userBalance ? userBalance.balance : 0}, need $${challenge.amount}. refunding -${challenge.challenger}`);
                    return { success: false };
                }

                // Deduct from challenged user atomically
                const deductResult = await bot.db.run(
                    'UPDATE user_economy SET balance = balance - ? WHERE username = ? AND balance >= ?',
                    [challenge.amount, message.username, challenge.amount]
                );
                
                if (deductResult.changes === 0) {
                    // Failed to deduct, cancel and refund
                    await bot.db.run(
                        'UPDATE coin_flip_challenges SET status = ? WHERE id = ?',
                        ['cancelled', challenge.id]
                    );

                    await bot.db.run(
                        'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
                        [challenge.amount, challenge.challenger]
                    );
                    
                    await bot.db.run('COMMIT');
                    
                    bot.sendMessage('couldn\'t deduct from ya balance mate, challenge cancelled');
                    return { success: false };
                }

                // Challenger gets opposite choice
                const challengerChoice = choice === 'heads' ? 'tails' : 'heads';

                // Flip the coin
                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                const winner = result === choice ? message.username : challenge.challenger;
                const loser = winner === message.username ? challenge.challenger : message.username;
                const prize = challenge.amount * 2;

                // Update challenge record
                await bot.db.run(
                    `UPDATE coin_flip_challenges 
                    SET status = ?, challenger_choice = ?, result = ?, winner = ?, resolved_at = ?
                    WHERE id = ?`,
                    ['completed', challengerChoice, result, winner, Date.now(), challenge.id]
                );

                // Pay winner atomically
                await bot.db.run(
                    'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
                    [prize, winner]
                );
                
                // Commit the transaction
                await bot.db.run('COMMIT');

                // Update stats for both players (outside transaction for performance)
                await this.updateStats(bot, challenge.challenger, challengerChoice === result, challenge.amount);
                await this.updateStats(bot, message.username, choice === result, challenge.amount);

                // Announce result
                const winnerTag = `-${winner}`;
                const loserTag = `-${loser}`;

                const resultMessages = [
                    `🪙 COIN FLIP: ${result.toUpperCase()}! ${winnerTag} takes $${prize} from ${loserTag}!`,
                    `it's ${result}! ${winnerTag} wins $${prize}! ${loserTag} is $${challenge.amount} poorer!`,
                    `${result.toUpperCase()}! ${winnerTag} cleans out ${loserTag} for $${prize}!`,
                    `coin says ${result}! ${winnerTag} pockets $${prize} while ${loserTag} cries!`
                ];

                bot.sendMessage(resultMessages[Math.floor(Math.random() * resultMessages.length)]);

                // Add snide commentary
                if (Math.random() < 0.4) {
                    setTimeout(() => {
                        const comments = [
                            `${loserTag} shoulda picked ${result === 'heads' ? 'heads' : 'tails'} ya muppet`,
                            `easy money for ${winnerTag}`,
                            `${loserTag}'s luck is shithouse today`,
                            `another victim of the flip`,
                            `${winnerTag} laughin all the way to the bottlo`
                        ];
                        bot.sendMessage(comments[Math.floor(Math.random() * comments.length)]);
                    }, 2000);
                }

                return { success: true };
                
            } catch (error) {
                await bot.db.run('ROLLBACK');
                throw error;
            }

        } catch (error) {
            bot.logger.error('Error handling coin flip response:', error);
            bot.sendMessage('coin flip machine exploded');
            return { success: false };
        }
    },

    async flipVsHouse(bot, message, amount) {
        try {
            await bot.db.run('BEGIN TRANSACTION');
            
            try {
                // Check balance and deduct bet atomically
                const deductResult = await bot.db.run(
                    'UPDATE user_economy SET balance = balance - ? WHERE username = ? AND balance >= ?',
                    [amount, message.username, amount]
                );
                
                if (deductResult.changes === 0) {
                    await bot.db.run('ROLLBACK');
                    const balance = await bot.heistManager.getUserBalance(message.username);
                    bot.sendMessage(`ya don't have enough money mate, need $${amount} but only got $${balance.balance}`);
                    return { success: false };
                }

                // Public acknowledgment
                if (!message.isPM) {
                    const announcements = [
                        `-${message.username} flips a coin against dazza for $${amount}...`,
                        `dazza accepts -${message.username}'s $${amount} coin flip challenge...`,
                        `-${message.username} tosses $${amount} in the air...`,
                        `$${amount} coin flip! -${message.username} vs the house...`
                    ];
                    bot.sendMessage(announcements[Math.floor(Math.random() * announcements.length)]);
                }

                // Player always calls it
                const playerChoice = Math.random() < 0.5 ? 'heads' : 'tails';
                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                const won = playerChoice === result;

                let resultMessage = '';
                let balance;

                if (won) {
                    // Pay out atomically
                    const winnings = amount * 2;
                    await bot.db.run(
                        'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
                        [winnings, message.username]
                    );
                    
                    // Commit the transaction
                    await bot.db.run('COMMIT');
                    
                    balance = await bot.heistManager.getUserBalance(message.username);

                    resultMessage = `🪙 You called ${playerChoice}, it's ${result}! You WIN $${winnings}!\nBalance: $${balance.balance}`;

                    // Public win announcement for big wins
                    if (!message.isPM && amount >= 100) {
                        setTimeout(() => {
                            bot.sendMessage(`fuckin hell! ${message.username} just won $${winnings} on a coin flip!`);
                        }, 1500);
                    }
                } else {
                    // Lost - just commit the deduction
                    await bot.db.run('COMMIT');
                    
                    balance = await bot.heistManager.getUserBalance(message.username);
                    resultMessage = `🪙 You called ${playerChoice}, it's ${result}! You LOST $${amount}!\nBalance: $${balance.balance}`;

                    // Dazza's commentary on losses
                    if (Math.random() < 0.3) {
                        setTimeout(() => {
                            const taunts = [
                                `shoulda called ${result} mate`,
                                `dazza's beer money grows by $${amount}`,
                                `${message.username}'s donation appreciated`,
                                `better luck next flip... or not`,
                                `the house always wins eventually`
                            ];
                            const taunt = taunts[Math.floor(Math.random() * taunts.length)];
                            bot.sendPrivateMessage(message.username, taunt);
                        }, 2000);
                    }
                }

                // Always send detailed result via PM
                bot.sendPrivateMessage(message.username, resultMessage);

                // Update stats (outside transaction for performance)
                await this.updateStats(bot, message.username, won, amount);

                // Track house stats under "dazza"
                await this.updateStats(bot, 'dazza', !won, amount);

                return { success: true };
                
            } catch (error) {
                await bot.db.run('ROLLBACK');
                throw error;
            }

        } catch (error) {
            bot.logger.error('Error in house coin flip:', error);
            bot.sendMessage('coin vanished into thin air mate');
            return { success: false };
        }
    },

    async updateStats(bot, username, won, amount) {
        try {
            const stats = await bot.db.get(
                'SELECT * FROM coin_flip_stats WHERE username = ?',
                [username]
            );

            if (!stats) {
                // Create new stats entry
                await bot.db.run(
                    `INSERT INTO coin_flip_stats 
                    (username, total_flips, heads_count, tails_count, wins, losses, 
                     total_wagered, total_won, total_lost, biggest_win, biggest_loss, 
                     current_streak, best_streak, last_played) 
                    VALUES (?, 1, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        username,
                        won ? 1 : 0,
                        won ? 0 : 1,
                        amount,
                        won ? amount * 2 : 0,
                        won ? 0 : amount,
                        won ? amount : 0,
                        won ? 0 : amount,
                        won ? 1 : -1,
                        won ? 1 : 0,
                        Date.now()
                    ]
                );
            } else {
                // Update existing stats
                const newWins = stats.wins + (won ? 1 : 0);
                const newLosses = stats.losses + (won ? 0 : 1);
                const newTotalWon = stats.total_won + (won ? amount * 2 : 0);
                const newTotalLost = stats.total_lost + (won ? 0 : amount);
                const newBiggestWin = won ? Math.max(stats.biggest_win, amount) : stats.biggest_win;
                const newBiggestLoss = won ? stats.biggest_loss : Math.max(stats.biggest_loss, amount);
                
                // Streak calculation
                let newStreak = stats.current_streak;
                if (won && newStreak >= 0) {
                    newStreak++;
                } else if (!won && newStreak <= 0) {
                    newStreak--;
                } else {
                    newStreak = won ? 1 : -1;
                }
                
                const newBestStreak = Math.max(stats.best_win_streak || stats.best_streak || 0, newStreak > 0 ? newStreak : 0);

                await bot.db.run(
                    `UPDATE coin_flip_stats 
                    SET total_flips = total_flips + 1,
                        wins = ?,
                        losses = ?,
                        total_wagered = total_wagered + ?,
                        total_won = ?,
                        total_lost = ?,
                        biggest_win = ?,
                        biggest_loss = ?,
                        current_streak = ?,
                        best_streak = ?,
                        last_played = ?
                    WHERE username = ?`,
                    [
                        newWins, newLosses, amount, newTotalWon, newTotalLost,
                        newBiggestWin, newBiggestLoss, newStreak, newBestStreak,
                        Date.now(), username
                    ]
                );
            }
        } catch (error) {
            bot.logger.error('Error updating coin flip stats:', error);
            // Don't fail the command over stats
        }
    }
});