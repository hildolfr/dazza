import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// Job descriptions for each tier
const jobDescriptions = {
    common: [
        // Regular jobs
        "helped old mate move a couch up three flights",
        "spent the arvo cleaning gutters, found a dead possum",
        "did some landscaping, mostly just mowin and whipper snippin",
        "painted a fence, got more paint on meself than the fence",
        "helped demo a bathroom, dust everywhere but easy money",
        "cleaned up after a party, kept the empties for meself too",
        "moved a piano, nearly did me back in the bastard",
        "pressure washed a driveway, satisfying as",
        "helped put together flatpack furniture from IKEA",
        "cleared out a garage full of spiders and junk"
    ],
    uncommon: [
        // Mix of regular and slightly dodgy
        "drove a 'mate' somewhere at 3am, no questions asked",
        "helped relocate some boxes from a warehouse after hours",
        "kept watch while someone 'retrieved their property'",
        "did some tiling work, she'll be right for a few years",
        "built a deck, few beers included which helped",
        "helped a bloke move out while his missus was at work",
        "delivered packages across town, definitely not drugs mate",
        "house sat for someone who grows 'tomatoes' indoors",
        "removed some copper from a demolition site",
        "test drove a car for someone who lost their license"
    ],
    rare: [
        // Dodgy and adult jobs
        "private entertainment at a bucks party, crikey what a night",
        "did some webcam work, the missus don't need to know",
        "helped test products that fell off a truck",
        "gave massages with extras at a dodgy parlour",
        "bounced at an underground poker game",
        "helped make someone's computer records disappear",
        "nude modeling for art students, bit nippy but good coin",
        "pretended to be someone's boyfriend at a wedding",
        "transported agricultural equipment across state lines",
        "provided pest control services to a competitor"
    ],
    legendary: [
        // High-paying very dodgy jobs
        "NO QUESTIONS ASKED JOB - made bank but can't talk about it",
        "drove a boat to international waters and back, great fishing",
        "private performances for rich widow, she tipped very well",
        "body double work for someone who needed an alibi",
        "helped acquire a vintage car from a private collection",
        "creative accounting consultant for local businesses",
        "participated in unofficial pharmaceutical trials",
        "relocation services for someone starting fresh",
        "security for a very exclusive private event",
        "stood around looking tough for some bikies, easy money"
    ]
};

// Failure messages
const failureMessages = [
    "Bloke never showed up to pay ya, the dodgy cunt",
    "Got halfway through and the cops rocked up, had to leg it",
    "Threw out me back lifting shit, can barely walk now",
    "Job was a bloody scam, wasted half me day for nothin",
    "Customer reckons the job wasn't done right, refused to pay"
];

// Calculate multipliers
function getMultiplier() {
    let multiplier = 1;
    let reasons = [];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    // Weekend bonus (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        multiplier *= 1.5;
        reasons.push("weekend rates");
    }

    // End of month bonus (28-31st)
    if (dayOfMonth >= 28) {
        multiplier *= 1.5;
        reasons.push("end of month rush");
    }

    return { multiplier, reasons };
}

export default new Command({
    name: 'cashie',
    aliases: ['cash', 'cashies', 'cashjob'],
    description: 'Find some cash-in-hand work (once per 12 hours)',
    usage: '!cashie',
    examples: ['!cashie - Look for cash work around town'],
    category: 'economy',
    pmAccepted: true,
    persistentCooldown: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = 'No cash jobs available right now mate';
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check persistent cooldown (12 hours)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db, bot.logger);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 43200000); // 12 hours
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const waitMessages = [
                        `oi -${message.username}, still too knackered from the last cashie. ${hours}h ${minutes}m til ya can work again`,
                        `-${message.username} mate, need to rest between jobs. Try again in ${hours}h ${minutes}m`,
                        `ease up -${message.username}, one cashie per shift. Wait ${hours}h ${minutes}m`,
                        `bloody hell -${message.username}, the tax man will notice! Cool it for ${hours}h ${minutes}m`
                    ];
                    
                    const selectedMsg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
                    if (message.isPM) {
                        sendPM(bot, message.username, selectedMsg.replace(/-/g, ''), message.roomContext || message.roomId);
                    } else {
                        bot.sendMessage(message.roomId, selectedMsg);
                    }
                    return { success: false };
                }
            }
            
            // Public acknowledgment (only if not PM)
            if (!message.isPM) {
                const publicMessages = [
                    `-${message.username} is headin out to find some cash work...`,
                    `-${message.username} is checkin the classifieds for cashies`,
                    `-${message.username} is askin around for odd jobs`,
                    `-${message.username} reckons they can make a quick buck`
                ];
                
                bot.sendMessage(message.roomId, publicMessages[Math.floor(Math.random() * publicMessages.length)]);
            }
            
            // Roll for failure (10% chance)
            const failureRoll = Math.random();
            if (failureRoll < 0.10) {
                const failureMsg = failureMessages[Math.floor(Math.random() * failureMessages.length)];
                
                let pmMessage = "❌ FUCKED! Your cashie fell through!\n";
                pmMessage += `📄 ${failureMsg}\n\n`;
                pmMessage += "Better luck next time mate. The cash economy's rough.";
                
                sendPM(bot, message.username, pmMessage, message.roomContext || message.roomId);
                
                // Record failed attempt
                if (bot.db) {
                    await bot.db.run(`
                        INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at)
                        VALUES (?, 0, 'cashie', 'Cash job failed', ?, ?)
                    `, [message.username, message.roomId || 'fatpizza', Date.now()]);
                }
                
                return { success: true };
            }
            
            // Determine tier and amount
            const tierRoll = Math.random();
            let tier, minAmount, maxAmount;
            
            if (tierRoll < 0.005) {
                // Legendary (0.5%)
                tier = 'legendary';
                minAmount = 300;
                maxAmount = 500;
            } else if (tierRoll < 0.015) {
                // Rare (1%)
                tier = 'rare';
                minAmount = 100;
                maxAmount = 200;
            } else if (tierRoll < 0.115) {
                // Uncommon (10%)
                tier = 'uncommon';
                minAmount = 40;
                maxAmount = 80;
            } else {
                // Common (88.5%)
                tier = 'common';
                minAmount = 15;
                maxAmount = 30;
            }
            
            // Calculate base amount
            let amount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
            
            // Apply multipliers
            const { multiplier, reasons } = getMultiplier();
            if (multiplier > 1) {
                amount = Math.floor(amount * multiplier);
            }
            
            // Get job description
            const jobDesc = jobDescriptions[tier][Math.floor(Math.random() * jobDescriptions[tier].length)];
            
            // Give money
            await bot.heistManager.updateUserEconomy(message.username, amount, 0);
            
            // Build PM message
            let pmMessage = "";
            if (tier === 'legendary') {
                pmMessage = `🎰 FUCK ME DEAD! MASSIVE CASHIE!\n`;
            } else if (tier === 'rare') {
                pmMessage = `💰 RIPPER CASHIE SCORE!\n`;
            } else {
                pmMessage = `✅ CASHIE COMPLETE!\n`;
            }
            
            pmMessage += `📄 You ${jobDesc}\n`;
            pmMessage += `💵 Earned $${amount} cash in hand`;
            
            if (reasons.length > 0) {
                pmMessage += ` (including ${reasons.join(' and ')})`;
            }
            
            pmMessage += `\n\n`;
            
            // Add flavor text based on amount
            if (amount >= 300) {
                pmMessage += "That's a week's worth of centerlink in one go! Don't spend it all on piss!";
            } else if (amount >= 100) {
                pmMessage += "Decent score! That'll keep the lights on and get a slab!";
            } else if (amount >= 50) {
                pmMessage += "Not bad for a day's work! Couple of bags and some durries!";
            } else {
                pmMessage += "Every dollar counts mate. That's a feed and a few tinnies!";
            }
            
            // Get updated balance
            const newBalance = await bot.heistManager.getUserBalance(message.username);
            pmMessage += `\n\nNew balance: $${newBalance.balance}`;
            
            // Send PM
            sendPM(bot, message.username, pmMessage, message.roomContext || message.roomId);
            
            // Public announcement for big scores (always announce, regardless of PM)
            if (tier === 'legendary' || (tier === 'rare' && amount >= 150)) {
                setTimeout(() => {
                    let announcement = `🚨 BIG CASHIE SCORE! ${message.username} just `;
                    if (tier === 'legendary') {
                        announcement += `made $${amount} from a very lucrative cash job! No questions asked!`;
                    } else {
                        announcement += `scored $${amount} cash in hand! Living the dream!`;
                    }
                    
                    bot.sendMessage(message.roomId, announcement);
                }, 2000);
            }
            
            // Record the transaction
            if (bot.db) {
                await bot.db.run(`
                    INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at)
                    VALUES (?, ?, 'cashie', ?, ?, ?)
                `, [message.username, amount, `${tier} job${multiplier > 1 ? ` (${reasons.join(', ')})` : ''}`, message.roomId || 'fatpizza', Date.now()]);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Cashie command error:', { error: error.message, stack: error.stack });
            const errorMsg = 'Cash job fell through, technical difficulties mate';
            if (message.isPM) {
                sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
            } else {
                bot.sendMessage(message.roomId, errorMsg);
            }
            return { success: false };
        }
    }
});