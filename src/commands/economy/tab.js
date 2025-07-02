import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// Australian race horses and dogs with bogan names
const horseNames = [
    "Shazza's Revenge", "Durry Breath", "Goon Sack Glory", "Servo Slammer",
    "Centrelink Special", "Bogan's Pride", "Thong Thrower", "Ute Destroyer",
    "VB Velocity", "Bunnings Bandit", "Dole Bludger", "Pie Floater",
    "Stubby Holder", "Barbie Burner", "Bottlo Runner", "Maccas Muncher",
    "Winnie Blue", "Tradie's Dream", "Pokies Prince", "She'll Be Right"
];

const dogNames = [
    "Cone Ripper", "Bong Water", "Pub Fighter", "Ciggie Butt",
    "Goon Bag Gary", "Flamin' Galah", "Snag Stealer", "Beer Gut Billy",
    "Dero Dog", "Mullet Master", "Thong Biter", "Servo Sniffer",
    "Tinnie Terror", "Eshay Express", "Bottlo Bandit", "Kebab Krusher"
];

// Track names for variety
const tracks = {
    horse: ["Flemington", "Randwick", "Moonee Valley", "Caulfield", "Rosehill"],
    dog: ["Wentworth Park", "The Gardens", "Sandown Park", "Albion Park", "The Meadows"]
};

// Race outcomes with crude commentary
const raceOutcomes = {
    win: [
        "FUCKIN' BEAUTY! {animal} wins by a nose! Ya lucky bastard!",
        "GET IN! {animal} takes it! Time to hit the bottlo with ya winnings!",
        "YEEEEW! {animal} comes from behind like me after 10 beers! You win!",
        "Fuckin' oath! {animal} smashes it harder than dazza's missus! Winner!",
        "RIPPER! {animal} wins it! Better than a blowie behind the servo!"
    ],
    place: [
        "Close one! {animal} comes {position} - ya get half ya bet back like a half-hearted handy",
        "Not bad! {animal} places {position} - enough for a few tinnies at least",
        "{animal} manages {position} place - better than a kick in the dick",
        "Decent effort! {animal} gets {position} - like finding a tenner in ya trackie dacks"
    ],
    lose: [
        "Fuckin' useless! {animal} runs like they're carrying me beer gut",
        "Christ! {animal} comes dead last - slower than me getting off the couch",
        "{animal} pulls up lame - probably been on the piss like me",
        "Absolute shocker! {animal} runs like they've had 20 cones before the race",
        "{animal} gives up halfway - must've seen the TAB odds",
        "Pathetic! {animal} finishes so far back they're still running",
        "{animal} trips over their own feet - drunk as a skunk"
    ]
};

export default new Command({
    name: 'tab',
    aliases: ['bet', 'punt', 'racing'],
    description: 'Bet on the horses or dogs at the TAB',
    usage: '!tab <amount> [horse|dog]',
    examples: [
        '!tab 10 - Bet $10 on a random horse race',
        '!tab 20 dog - Bet $20 on the dogs',
        '!tab 50 horse - Bet $50 on the horses'
    ],
    category: 'economy',
    cooldown: 7200000, // 2 hour cooldown
    cooldownMessage: 'mate the stewards are still draggin\' the dead horse off the track, come back in {time}s',
    pmAccepted: true,
    persistentCooldown: true, // Enable persistent cooldown
    
    async handler(bot, message, args) {
        try {
            // Check persistent cooldown if database is available
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, this.cooldown);
                
                if (!cooldownCheck.allowed) {
                    const cooldownMsg = this.cooldownMessage.replace('{time}', cooldownCheck.remaining);
                    if (message.isPM) {
                        sendPM(bot, message.username, cooldownMsg, message.roomContext || message.roomId);
                    } else {
                        bot.sendMessage(message.roomId, cooldownMsg);
                    }
                    return { success: false };
                }
            }
            if (!bot.heistManager) {
                const errorMsg = 'TAB machine\'s fucked mate, try again later';
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check if user has provided amount
            const amount = parseInt(args[0]);
            if (!amount || amount < 1) {
                const errorMsg = `oi -${message.username}, gotta tell me how much to bet ya drongo! Like: !tab 20`;
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg.replace('-', ''), message.roomContext || message.roomId); // Remove - prefix in PMs
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Determine race type
            const raceType = args[1]?.toLowerCase() || 'horse';
            if (!['horse', 'dog'].includes(raceType)) {
                const errorMsg = `-${message.username} mate, it's either 'horse' or 'dog', not whatever the fuck "${args[1]}" is`;
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg.replace('-', ''), message.roomContext || message.roomId); // Remove - prefix in PMs
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Get user balance
            const userEcon = await bot.heistManager.getUserBalance(message.username);
            if (userEcon.balance < amount) {
                const insults = [
                    `ya broke cunt -${message.username}, ya only got $${userEcon.balance}`,
                    `-${message.username} ya can't bet $${amount} when ya only got $${userEcon.balance} ya numpty`,
                    `mate -${message.username}, check ya pockets - only $${userEcon.balance} in there`,
                    `fuckin' dreamin -${message.username}! ya need $${amount - userEcon.balance} more`
                ];
                const selectedInsult = insults[Math.floor(Math.random() * insults.length)];
                if (message.isPM) {
                    sendPM(bot, message.username, selectedInsult.replace(/-/g, ''), message.roomContext || message.roomId); // Remove all - prefixes in PMs
                } else {
                    bot.sendMessage(message.roomId, selectedInsult);
                }
                return { success: false };
            }

            // Maximum bet check
            const maxBet = Math.min(500, userEcon.balance);
            if (amount > maxBet) {
                const errorMsg = `steady on -${message.username}, max bet is $${maxBet} - this ain't Crown Casino`;
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg.replace('-', ''), message.roomContext || message.roomId); // Remove - prefix in PMs
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Deduct bet amount
            await bot.heistManager.updateUserEconomy(message.username, -amount, 0);

            // Select animals and track
            const animalList = raceType === 'horse' ? horseNames : dogNames;
            const selectedAnimals = [];
            const usedIndexes = new Set();
            
            // Pick 6 random animals
            while (selectedAnimals.length < 6) {
                const index = Math.floor(Math.random() * animalList.length);
                if (!usedIndexes.has(index)) {
                    usedIndexes.add(index);
                    selectedAnimals.push(animalList[index]);
                }
            }

            const track = tracks[raceType][Math.floor(Math.random() * tracks[raceType].length)];
            const raceNumber = Math.floor(Math.random() * 8) + 1;

            // Public acknowledgment only (skip if PM)
            if (!message.isPM) {
                const publicAcknowledgments = [
                    `🏇 -${message.username} placed $${amount} on the ${raceType}s at ${track}, race ${raceNumber} - check ya PMs for the race!`,
                    `🎰 -${message.username} is punting $${amount} at the TAB, PMing the race results`,
                    `📢 Bet placed for -${message.username}! $${amount} on race ${raceNumber}, results via PM`,
                    `🏁 -${message.username} backs the ${raceType}s with $${amount}, I'll PM ya the action`
                ];
                
                bot.sendMessage(message.roomId, publicAcknowledgments[Math.floor(Math.random() * publicAcknowledgments.length)]);
            }

            // User's selection (random)
            const userPick = Math.floor(Math.random() * 6);
            const userAnimal = selectedAnimals[userPick];
            const userOdds = Math.floor(Math.random() * 15) + 2;
            
            // Send first PM: Race info and selection
            const fieldShort = selectedAnimals.map((animal, i) => 
                `${i + 1}. ${animal}${i === userPick ? ' ← YOUR BET' : ''}`
            ).join(' | ');
            
            sendPM(bot, message.username, 
                `🏇 Race ${raceNumber} at ${track} | You backed #${userPick + 1} ${userAnimal} ($${amount} @ ${userOdds}:1)`,
                message.roomContext || message.roomId
            );
            
            // Small delay before race result
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Determine race outcome
            const outcome = Math.random();
            let winnings = 0;
            
            // Build concise result message
            let resultMessage = "";
            let publicAnnouncement = null;
            let forcedShare = false;
            
            // 20% chance to win, 30% chance to place (2nd/3rd), 50% chance to lose
            if (outcome < 0.20) {
                // WIN!
                winnings = amount * userOdds;
                const winMsg = raceOutcomes.win[Math.floor(Math.random() * raceOutcomes.win.length)]
                    .replace('{animal}', userAnimal);
                
                await bot.heistManager.updateUserEconomy(message.username, winnings, 1);
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                
                resultMessage = `${winMsg} | 💰 WON $${winnings}! | Balance: $${newBalance.balance}`;
                
                // Announce big wins (10x or more)
                if (userOdds >= 10) {
                    publicAnnouncement = `🎆 BIG WIN AT THE TAB! ${message.username} just won $${winnings} on ${userAnimal} at ${userOdds}:1 odds!`;
                    
                    if (winnings >= 300) {
                        forcedShare = true;
                        publicAnnouncement += ` Dazza's takin' a cut for everyone!`;
                    }
                }
                
            } else if (outcome < 0.50) {
                // PLACE (2nd or 3rd)
                const position = outcome < 0.35 ? "2nd" : "3rd";
                winnings = Math.floor(amount * 0.5); // Get half back
                const placeMsg = raceOutcomes.place[Math.floor(Math.random() * raceOutcomes.place.length)]
                    .replace('{animal}', userAnimal)
                    .replace('{position}', position);
                
                await bot.heistManager.updateUserEconomy(message.username, winnings, 0);
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                
                resultMessage = `${placeMsg} | 🥈 Got $${winnings} back | Balance: $${newBalance.balance}`;
                
            } else {
                // LOSE
                const loseMsg = raceOutcomes.lose[Math.floor(Math.random() * raceOutcomes.lose.length)]
                    .replace('{animal}', userAnimal);
                
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                
                resultMessage = `${loseMsg} | ❌ Lost $${amount} | Balance: $${newBalance.balance}`;
            }
            
            // Send second PM with race result
            sendPM(bot, message.username, resultMessage, message.roomContext || message.roomId);
            
            // Handle public announcements
            if (publicAnnouncement) {
                setTimeout(() => {
                    bot.sendMessage(message.roomId, publicAnnouncement);
                }, 2000);
            }
            
            // Handle forced sharing for wins over $300
            if (forcedShare && winnings >= 300) {
                setTimeout(async () => {
                    try {
                        // Get all online users (excluding the winner and bots)
                        const onlineUsers = Array.from(bot.userlist.values())
                            .filter(u => !u.meta.afk && 
                                    u.name.toLowerCase() !== message.username.toLowerCase() &&
                                    u.name.toLowerCase() !== bot.username.toLowerCase() &&
                                    !u.name.startsWith('['));
                        
                        if (onlineUsers.length > 0) {
                            // Calculate shares - winner keeps 50%, rest split among others + dazza
                            const winnerShare = Math.floor(winnings * 0.5);
                            const remainingAmount = winnings - winnerShare;
                            const sharePerUser = Math.floor(remainingAmount / (onlineUsers.length + 1)); // +1 for dazza
                            const dazzaShare = remainingAmount - (sharePerUser * onlineUsers.length);
                            
                            // Deduct the shared amount from winner (they already got the full amount)
                            await bot.heistManager.updateUserEconomy(message.username, -remainingAmount, 0);
                            
                            // Give each user their share
                            for (const user of onlineUsers) {
                                await bot.heistManager.updateUserEconomy(user.name, sharePerUser, 0);
                            }
                            
                            // Dazza gets his cut
                            await bot.heistManager.updateUserEconomy('dazza', dazzaShare, 0);
                            
                            // Announce the sharing
                            const shareMessages = [
                                `everyone gets $${sharePerUser} from ${message.username}'s massive TAB win! I'm pocketin' $${dazzaShare} as the bookie's cut`,
                                `splittin' the winnings! $${sharePerUser} each from ${message.username}'s punt, $${dazzaShare} for me troubles`,
                                `TAB payout time! everyone scores $${sharePerUser}, I take $${dazzaShare} for runnin' the numbers`,
                                `sharing is caring! $${sharePerUser} each from ${message.username}'s lucky streak, plus $${dazzaShare} for Dazza`
                            ];
                            
                            setTimeout(() => {
                                bot.sendMessage(message.roomId, shareMessages[Math.floor(Math.random() * shareMessages.length)]);
                            }, 1000);
                        }
                    } catch (error) {
                        bot.logger.error('Error sharing TAB winnings:', { error: error.message, stack: error.stack });
                    }
                }, 4000);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('TAB command error:', { error: error.message, stack: error.stack });
            const errorMsg = 'TAB machine just ate ya money and caught fire. typical.';
            if (message.isPM) {
                sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
            } else {
                bot.sendMessage(message.roomId, errorMsg);
            }
            return { success: false };
        }
    }
});