import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// Dole payment excuses/reasons when you get paid
const paymentReasons = [
    "Back injury from liftin' tinnies",
    "Anxiety from the bottlo being closed on Sundays", 
    "Chronic cone dependency requiring daily medication",
    "Allergic to work uniforms",
    "PTSD from seein' the price of durries",
    "Repetitive strain injury from scratchin' me balls",
    "Depression from Shazza leavin' (again)",
    "Can't work mornings due to persistent hangovers",
    "Phobia of wearing closed-toe shoes",
    "Chronic fatigue from stayin' up for the footy",
    "Bad knee from kickin' the dog (accidentally)",
    "Carpal tunnel from holdin' the bong",
    "Severe allergy to responsibility",
    "Emotional trauma from VB price increase",
    "Back problems from sleepin' on the couch",
    "Anxiety attacks when near employment offices",
    "Chronic pain from wearing thongs year-round",
    "ADHD (Absolutely Despise Having Duties)",
    "Allergic reaction to alarm clocks",
    "Permanent injury from a servo pie incident"
];

// Rejection reasons when they don't get paid
const rejectionReasons = [
    "Caught working cash in hand at Davo's",
    "Forgot to report ya scratchie winnings",
    "Missed your appointment (were on the piss)",
    "They saw ya Instagram from Bali last month",
    "Failed to apply for 20 jobs this month",
    "Got dobbed in by ya ex-missus",
    "System shows you've been earning from fishing",
    "Caught on camera at the TAB during 'job interview'",
    "Didn't answer the phone for your job capacity assessment",
    "Your medical certificate was written in crayon",
    "They found out about your cash pokies wins",
    "You listed 'professional bong ripper' as work experience",
    "Caught sellin' ciggies out the boot of ya car",
    "Your doctor's certificate was signed 'Dr. Dazza'",
    "Failed drug test (tested positive for employment)",
    "Seen working at the pub (drinking doesn't count as work)",
    "Your job diary just said 'fuck off' for every day",
    "Dobbed in by Shazza for child support",
    "Caught breeding staffies in the backyard",
    "They googled your name and found your soundcloud rap career"
];

// Random payment amounts based on 'benefit type'
const benefitTypes = [
    { name: "JobSeeker", min: 20, max: 40 },
    { name: "Youth Allowance", min: 15, max: 30 },
    { name: "Disability Pension", min: 30, max: 50 },
    { name: "Carer Payment", min: 25, max: 45 },
    { name: "Parenting Payment", min: 20, max: 35 },
    { name: "Special Benefit", min: 10, max: 25 }
];

// Rare high-reward payments (0.5-1% chance)
const rarePayments = [
    { 
        name: "Back Payment Error", 
        min: 300, 
        max: 500, 
        reason: "Computer glitch paid you 6 months of back payments!",
        publicMsg: "scored a back payment error"
    },
    { 
        name: "Disability Reassessment Bonus", 
        min: 400, 
        max: 700, 
        reason: "They finally admitted your chronic cone dependency is a disability!",
        publicMsg: "got disability for being too cooked"
    },
    { 
        name: "Dead Relative's Pension", 
        min: 500, 
        max: 800, 
        reason: "Uncle Bruce's pension kept coming after he carked it!",
        publicMsg: "inherited dead Uncle Bruce's pension"
    },
    { 
        name: "COVID Disaster Payment", 
        min: 600, 
        max: 1000, 
        reason: "Found an old COVID payment they forgot to give ya!",
        publicMsg: "found forgotten COVID money"
    },
    { 
        name: "System Malfunction Jackpot", 
        min: 800, 
        max: 1000, 
        reason: "The mainframe shit itself and gave you EVERYTHING!",
        publicMsg: "broke the Centrelink mainframe"
    }
];

export default new Command({
    name: 'centrelink',
    aliases: ['dole', 'welfare', 'centerlink', 'payments'],
    description: 'Try to collect your Centrelink payment (once per 24 hours, 50% chance)',
    usage: '!centrelink',
    examples: ['!centrelink - Attempt to collect your government payment'],
    category: 'economy',
    cooldown: 86400000, // 24 hour cooldown for actual payment
    cooldownMessage: 'oi -${username}, ya already collected today! Come back in {time}s',
    pmAccepted: true,
    persistentCooldown: true, // Enable persistent cooldown
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = 'Centrelink system is down for maintenance (surprise surprise)';
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check persistent cooldown if database is available
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, this.cooldown);
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const waitMessages = [
                        `oi -${message.username}, ya already collected today! Come back in ${hours}h ${minutes}m`,
                        `-${message.username} mate, one payment per day. ${hours}h ${minutes}m til the next one`,
                        `computer says no -${message.username}. Try again in ${hours}h ${minutes}m`,
                        `fuckin' hell -${message.username}, the government ain't made of money! Wait ${hours}h ${minutes}m`,
                        `patience -${message.username}! Next payment in ${hours}h ${minutes}m. Go have a cone`
                    ];
                    
                    const selectedMsg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
                    if (message.isPM) {
                        sendPM(bot, message.username, selectedMsg.replace(/-/g, ''), message.roomContext || message.roomId); // Remove - prefixes in PMs
                    } else {
                        bot.sendMessage(message.roomId, selectedMsg);
                    }
                    return { success: false };
                }
            }
            
            // Public acknowledgment only (skip if PM)
            if (!message.isPM) {
                const publicAcknowledgments = [
                    `Processing centrelink claim for -${message.username}...`,
                    `Checking -${message.username}'s eligibility, check ya PMs mate`,
                    `-${message.username} is at the centrelink office, results coming via PM`,
                    `Running -${message.username} through the system, PMing the outcome`
                ];
                
                bot.sendMessage(message.roomId, publicAcknowledgments[Math.floor(Math.random() * publicAcknowledgments.length)]);
            }
            
            // Check for rare payments first (0.5-1% chance)
            const rareRoll = Math.random();
            const paymentChance = Math.random();
            
            // Build PM message with all the details
            let pmMessage = "";
            let publicAnnouncement = null;
            let forcedShare = false;
            let amount = 0;
            
            if (rareRoll < 0.01) {
                // RARE PAYMENT! (1% chance)
                const rarePayment = rarePayments[Math.floor(Math.random() * rarePayments.length)];
                amount = Math.floor(Math.random() * (rarePayment.max - rarePayment.min + 1)) + rarePayment.min;
                
                pmMessage = `🎰 HOLY FUCKIN' JACKPOT! ${rarePayment.name}!\n`;
                pmMessage += `📄 ${rarePayment.reason}\n\n`;
                pmMessage += `💰 **YOU GOT $${amount}!!!**\n\n`;
                pmMessage += `Better cash this before they realize their mistake!`;
                
                // Always announce rare payments
                publicAnnouncement = `🚨 CENTRELINK JACKPOT! ${message.username} just ${rarePayment.publicMsg} worth $${amount}!`;
                
                if (amount >= 300) {
                    forcedShare = true;
                    publicAnnouncement += ` Dazza's dobbin' to make sure everyone gets their cut!`;
                }
                
                // Give money
                await bot.heistManager.updateUserEconomy(message.username, amount, 0);
                
            } else if (paymentChance < 0.50) {
                // SUCCESS - Payment approved!
                const benefit = benefitTypes[Math.floor(Math.random() * benefitTypes.length)];
                const amount = Math.floor(Math.random() * (benefit.max - benefit.min + 1)) + benefit.min;
                const reason = paymentReasons[Math.floor(Math.random() * paymentReasons.length)];
                
                // Give money
                await bot.heistManager.updateUserEconomy(message.username, amount, 0);
                
                pmMessage = `✅ APPROVED! You got $${amount} from ${benefit.name}!\n`;
                pmMessage += `📄 Reason: "${reason}"\n\n`;
                
                // Add commentary
                const extraComments = [
                    "First stop: bottle-o!",
                    "That's a carton and a pack of Winnie Blues sorted",
                    "Pokies here I come!",
                    "Time to pay Shazza that child support... nah fuck it",
                    "Straight to the TAB with this one"
                ];
                pmMessage += extraComments[Math.floor(Math.random() * extraComments.length)];
                
                // Get updated balance
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                pmMessage += `\n\nNew balance: $${newBalance.balance}`;
                
            } else {
                // FAILED - Payment rejected
                const reason = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
                
                pmMessage = `❌ REJECTED! No payment today mate.\n`;
                pmMessage += `📄 Reason: "${reason}"\n\n`;
                
                // Add suggestions
                const suggestions = [
                    "Maybe try getting a job? ...nah who am I kidding",
                    "There's always the salvos mate",
                    "Time to check the couch cushions for change",
                    "Shazza's mum might lend ya a twenty",
                    "Guess it's 2-minute noodles again this week",
                    "Could always try the fishing or TAB for some quick cash"
                ];
                pmMessage += suggestions[Math.floor(Math.random() * suggestions.length)];
            }
            
            // Send the PM with all details
            sendPM(bot, message.username, pmMessage, message.roomContext || message.roomId);
            
            // Handle public announcements
            if (publicAnnouncement) {
                setTimeout(() => {
                    bot.sendMessage(message.roomId, publicAnnouncement);
                }, 2000);
            }
            
            // Handle forced sharing for payments over $300
            if (forcedShare && amount >= 300) {
                setTimeout(async () => {
                    try {
                        // Get all online users (excluding the recipient and bots)
                        const onlineUsers = Array.from(bot.userlist.values())
                            .filter(u => !u.meta.afk && 
                                    u.name.toLowerCase() !== message.username.toLowerCase() &&
                                    u.name.toLowerCase() !== bot.username.toLowerCase() &&
                                    !u.name.startsWith('['));
                        
                        if (onlineUsers.length > 0) {
                            // Calculate shares - recipient keeps 50%, rest split among others + dazza
                            const recipientShare = Math.floor(amount * 0.5);
                            const remainingAmount = amount - recipientShare;
                            const sharePerUser = Math.floor(remainingAmount / (onlineUsers.length + 1)); // +1 for dazza
                            const dazzaShare = remainingAmount - (sharePerUser * onlineUsers.length);
                            
                            // Deduct the shared amount from recipient (they already got the full amount)
                            await bot.heistManager.updateUserEconomy(message.username, -remainingAmount, 0);
                            
                            // Give each user their share
                            for (const user of onlineUsers) {
                                await bot.heistManager.updateUserEconomy(user.name, sharePerUser, 0);
                            }
                            
                            // Dazza gets his cut
                            await bot.heistManager.updateUserEconomy('dazza', dazzaShare, 0);
                            
                            // Announce the sharing
                            const shareMessages = [
                                `everyone gets $${sharePerUser} from ${message.username}'s dodgy centrelink payout! I'm takin' $${dazzaShare} for snitchin'`,
                                `wealth redistribution! $${sharePerUser} each from ${message.username}'s government windfall, $${dazzaShare} for me dobbin' fee`,
                                `socialism in action! everyone scores $${sharePerUser}, I pocket $${dazzaShare} for alertin' the authorities`,
                                `${message.username}'s tax dollars at work! $${sharePerUser} each, plus $${dazzaShare} for ya boy Dazza`
                            ];
                            
                            setTimeout(() => {
                                bot.sendMessage(message.roomId, shareMessages[Math.floor(Math.random() * shareMessages.length)]);
                            }, 1000);
                        }
                    } catch (error) {
                        bot.logger.error('Error sharing centrelink rewards:', error);
                    }
                }, 4000);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Centrelink command error:', error);
            const errorMsg = 'Centrelink computer crashed. Standard Monday really.';
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, errorMsg);
            } else {
                bot.sendMessage(message.roomId, errorMsg);
            }
            return { success: false };
        }
    }
});