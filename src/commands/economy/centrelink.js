import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';

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
                bot.sendMessage('Centrelink system is down for maintenance (surprise surprise)');
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
                    
                    bot.sendMessage(waitMessages[Math.floor(Math.random() * waitMessages.length)]);
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
                
                bot.sendMessage(publicAcknowledgments[Math.floor(Math.random() * publicAcknowledgments.length)]);
            }
            
            // 40-60% chance of payment
            const paymentChance = Math.random();
            
            // Build PM message with all the details
            let pmMessage = "";
            
            if (paymentChance < 0.50) {
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
            bot.sendPrivateMessage(message.username, pmMessage);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Centrelink command error:', error);
            bot.sendMessage('Centrelink computer crashed. Standard Monday really.');
            return { success: false };
        }
    }
});