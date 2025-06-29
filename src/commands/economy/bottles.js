import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';

// Messages for each tier of recycling success
const tierMessages = {
    common: [
        "Found a decent haul behind the servo",
        "Couple bags of stubbies from last night's sesh",
        "Scored some empties from the park bins",
        "Nicked a few bags from me neighbor's recycling",
        "Found some tinnies in the creek",
        "Cleaned out the ute tray, found heaps",
        "Raided the bins at the footy oval"
    ],
    uncommon: [
        "Found a whole esky full behind the pub!",
        "Some legend left bags of empties by the bottle-o",
        "Scored big at the beach carpark after Australia Day",
        "Found pristine bottles at the rich cunts' estate sale",
        "Jackpot at the construction site skip bin"
    ],
    rare: [
        "Holy shit, found bottles from a whole wedding reception!",
        "Cleaned up after the B&S ball, fuckin' goldmine!",
        "Found some vintage bottles worth extra at the tip shop",
        "Corporate function leftovers, premium bottles everywhere!"
    ],
    legendary: [
        "FOUND A WHOLE PALLET OF EMPTIES BEHIND DAN MURPHY'S!!!",
        "MUSIC FESTIVAL CLEANUP CREW LEFT EVERYTHING!!!",
        "RICH BASTARD'S PARTY AFTERMATH, IMPORTED BOTTLES GALORE!!!",
        "BOTTLE DEPOT HAD A GLITCH AND PAID TRIPLE!!!"
    ]
};

// Failure messages
const failureMessages = [
    "Bloody hobos nicked me bag of empties",
    "Cops moved me on from behind woolies", 
    "Machine was fucked, wouldn't take crushed cans",
    "Some karen called security on me at the shops",
    "Bottle-o reckons me cans were 'contaminated' or some shit"
];

// Check if it's a special bonus period
function getMultiplier() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const month = now.getMonth(); // 0 = January, 11 = December
    const currentDate = now.getDate();
    
    let multiplier = 1;
    let reason = null;
    
    // Monday (1) or Tuesday (2) - post-weekend bonus
    if (dayOfWeek === 1 || dayOfWeek === 2) {
        multiplier = 1.5;
        reason = "post-weekend bonus";
    }
    
    // December - Christmas parties bonus
    if (month === 11) {
        multiplier = 2;
        reason = "Christmas party season";
    }
    
    // Grand Final week (last week of September)
    if (month === 8 && currentDate >= 22 && currentDate <= 28) {
        multiplier = 2;
        reason = "Grand Final week madness";
    }
    
    return { multiplier, reason };
}

export default new Command({
    name: 'bottles',
    aliases: ['bottle', 'cans', 'recycling', 'empties'],
    description: 'Collect bottles and cans for the 10c refund (once per 24 hours)',
    usage: '!bottles',
    examples: ['!bottles - Go hunting for empties to recycle'],
    category: 'economy',
    pmAccepted: true,
    persistentCooldown: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = 'Bottle depot is closed for maintenance mate';
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg);
                } else {
                    bot.sendMessage(errorMsg);
                }
                return { success: false };
            }

            // Check persistent cooldown
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 86400000); // 24 hours
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const waitMessages = [
                        `oi -${message.username}, ya already did ya bottle run today! Come back in ${hours}h ${minutes}m`,
                        `-${message.username} mate, one recycling trip per day. ${hours}h ${minutes}m til the next one`,
                        `the depot's got ya number -${message.username}. Try again in ${hours}h ${minutes}m`,
                        `fuckin' hell -${message.username}, leave some bottles for the other battlers! Wait ${hours}h ${minutes}m`,
                        `patience -${message.username}! Next bottle run in ${hours}h ${minutes}m. Go have a cone`
                    ];
                    
                    const selectedMsg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
                    if (message.isPM) {
                        bot.sendPrivateMessage(message.username, selectedMsg.replace(/-/g, ''));
                    } else {
                        bot.sendMessage(selectedMsg);
                    }
                    return { success: false };
                }
            }
            
            // Public acknowledgment
            if (!message.isPM) {
                const publicMessages = [
                    `-${message.username} is heading out with the shopping trolley...`,
                    `-${message.username} is doing the bottle run, check ya PMs for results`,
                    `-${message.username} is off to check the usual spots for empties`,
                    `-${message.username} grabbed the ute and some garbage bags, bottle hunting time`
                ];
                
                bot.sendMessage(publicMessages[Math.floor(Math.random() * publicMessages.length)]);
            }
            
            // Roll for failure (8% chance)
            const failureRoll = Math.random();
            if (failureRoll < 0.08) {
                const failureMsg = failureMessages[Math.floor(Math.random() * failureMessages.length)];
                
                let pmMessage = "❌ FUCKED! Your bottle run failed!\n";
                pmMessage += `📄 ${failureMsg}\n\n`;
                pmMessage += "Better luck tomorrow mate. Maybe try a different spot.";
                
                bot.sendPrivateMessage(message.username, pmMessage);
                
                // Record the transaction as failed
                if (bot.db) {
                    await bot.db.run(`
                        INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                        VALUES (?, 0, 'bottles', 'Bottle run failed', ?)
                    `, [message.username, Date.now()]);
                }
                
                return { success: true };
            }
            
            // Determine tier and amount
            const tierRoll = Math.random();
            let tier, minAmount, maxAmount;
            
            if (tierRoll < 0.005) {
                // Legendary (0.5%)
                tier = 'legendary';
                minAmount = 100;
                maxAmount = 150;
            } else if (tierRoll < 0.025) {
                // Rare (2%)
                tier = 'rare';
                minAmount = 30;
                maxAmount = 50;
            } else if (tierRoll < 0.275) {
                // Uncommon (25%)
                tier = 'uncommon';
                minAmount = 15;
                maxAmount = 25;
            } else {
                // Common (72.5%)
                tier = 'common';
                minAmount = 5;
                maxAmount = 10;
            }
            
            // Calculate base amount
            let amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
            
            // Apply multipliers
            const { multiplier, reason } = getMultiplier();
            if (multiplier > 1) {
                amount = Math.floor(amount * multiplier);
            }
            
            // Get tier message
            const tierMessage = tierMessages[tier][Math.floor(Math.random() * tierMessages[tier].length)];
            
            // Give money
            await bot.heistManager.updateUserEconomy(message.username, amount, 0);
            
            // Build PM message
            let pmMessage = "";
            if (tier === 'legendary') {
                pmMessage = `🎰 HOLY FUCKIN' JACKPOT!\n`;
            } else if (tier === 'rare') {
                pmMessage = `💰 RIPPER HAUL!\n`;
            } else {
                pmMessage = `✅ BOTTLES CASHED IN!\n`;
            }
            
            pmMessage += `📄 ${tierMessage}\n`;
            pmMessage += `💵 You got $${amount}`;
            
            if (multiplier > 1) {
                pmMessage += ` (${multiplier}x ${reason}!)`;
            }
            
            pmMessage += `\n\n`;
            
            // Add flavor text based on amount
            if (amount >= 100) {
                pmMessage += "That's a fuckin' fortune! Time to shout the boys!";
            } else if (amount >= 50) {
                pmMessage += "Decent score! That's a carton sorted!";
            } else if (amount >= 20) {
                pmMessage += "Not bad! Few packs of darts and a six-pack!";
            } else {
                pmMessage += "Every bit helps mate. That's lunch at the servo!";
            }
            
            // Get updated balance
            const newBalance = await bot.heistManager.getUserBalance(message.username);
            pmMessage += `\n\nNew balance: $${newBalance.balance}`;
            
            // Send PM
            bot.sendPrivateMessage(message.username, pmMessage);
            
            // Public announcement for big wins (always announce, regardless of PM)
            if (tier === 'legendary' || (tier === 'rare' && amount >= 80)) {
                setTimeout(() => {
                    let announcement = `🚨 BOTTLE JACKPOT! ${message.username} just `;
                    if (tier === 'legendary') {
                        announcement += `scored $${amount} from bottles! ${tierMessage}`;
                    } else {
                        announcement += `made $${amount} recycling! Fuckin' legend!`;
                    }
                    
                    bot.sendMessage(announcement);
                }, 2000);
            }
            
            // Record the transaction
            if (bot.db) {
                await bot.db.run(`
                    INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                    VALUES (?, ?, 'bottles', ?, ?)
                `, [message.username, amount, `${tier} haul${multiplier > 1 ? ` (${multiplier}x ${reason})` : ''}`, Date.now()]);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Bottles command error:', error);
            const errorMsg = 'Bottle depot machine shit itself. Classic.';
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, errorMsg);
            } else {
                bot.sendMessage(errorMsg);
            }
            return { success: false };
        }
    }
});