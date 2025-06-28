import { Command } from '../base.js';

// Track last collection time per user (24 hour cooldown)
const lastCollection = new Map();

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
    description: 'Try to collect your Centrelink payment (once per 24 hours)',
    usage: '!centrelink',
    examples: ['!centrelink - Attempt to collect your government payment'],
    category: 'economy',
    cooldown: 5000, // 5 second command cooldown (actual payment is 24hr)
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendMessage('Centrelink system is down for maintenance (surprise surprise)');
                return { success: false };
            }

            const now = Date.now();
            const userId = message.username.toLowerCase();
            const lastTime = lastCollection.get(userId);
            
            // Check 24 hour cooldown
            if (lastTime) {
                const timeSince = now - lastTime;
                const timeLeft = (24 * 60 * 60 * 1000) - timeSince;
                
                if (timeLeft > 0) {
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    
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
            
            // Announce checking eligibility
            const checkingMessages = [
                `📋 -${message.username} rocks up to Centrelink in their finest trackie dacks...`,
                `📋 -${message.username} joins the queue behind 50 other bludgers...`,
                `📋 -${message.username} hands over their crumpled forms...`,
                `📋 -${message.username} tries to look disabled enough for payments...`
            ];
            
            bot.sendMessage(checkingMessages[Math.floor(Math.random() * checkingMessages.length)]);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Processing messages
            const processingMessages = [
                "👩‍💼 *Karen from Centrelink reviews your case*",
                "🖥️ *Ancient government computer processes your claim*",
                "☎️ *They're calling your references (hope Davo's sober)*",
                "📊 *Checking if you've been a good little dole bludger*"
            ];
            
            bot.sendMessage(processingMessages[Math.floor(Math.random() * processingMessages.length)]);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 10-15% chance of payment as requested
            const paymentChance = Math.random();
            
            if (paymentChance < 0.15) {
                // SUCCESS - Payment approved!
                const benefit = benefitTypes[Math.floor(Math.random() * benefitTypes.length)];
                const amount = Math.floor(Math.random() * (benefit.max - benefit.min + 1)) + benefit.min;
                const reason = paymentReasons[Math.floor(Math.random() * paymentReasons.length)];
                
                // Update last collection time
                lastCollection.set(userId, now);
                
                // Give money
                await bot.heistManager.updateUserEconomy(message.username, amount, 0);
                
                const successMessages = [
                    `✅ APPROVED! -${message.username} gets $${amount} ${benefit.name} payment!`,
                    `✅ Beauty! -${message.username} scores $${amount} from ${benefit.name}!`,
                    `✅ Ripper! -${message.username}'s ${benefit.name} payment of $${amount} came through!`,
                    `✅ Fuckin' oath! -${message.username} gets their $${amount} ${benefit.name} payment!`
                ];
                
                bot.sendMessage(successMessages[Math.floor(Math.random() * successMessages.length)]);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                bot.sendMessage(`📄 Reason: "${reason}"`);
                
                // Sometimes add extra commentary
                if (Math.random() < 0.3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const extraComments = [
                        "First stop: bottle-o!",
                        "That's a carton and a pack of Winnie Blues sorted",
                        "Pokies here I come!",
                        "Time to pay Shazza that child support... nah fuck it",
                        "Straight to the TAB with this one"
                    ];
                    bot.sendMessage(extraComments[Math.floor(Math.random() * extraComments.length)]);
                }
                
            } else {
                // FAILED - Payment rejected
                const reason = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
                
                // Still update collection time so they can't spam
                lastCollection.set(userId, now);
                
                const failMessages = [
                    `❌ REJECTED! -${message.username} gets fuck all today!`,
                    `❌ DENIED! -${message.username} leaves empty handed!`,
                    `❌ Computer says NO for -${message.username}!`,
                    `❌ Bad luck -${message.username}, no payment today!`
                ];
                
                bot.sendMessage(failMessages[Math.floor(Math.random() * failMessages.length)]);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                bot.sendMessage(`📄 Reason: "${reason}"`);
                
                // Sometimes suggest alternatives
                if (Math.random() < 0.3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const suggestions = [
                        "Maybe try getting a job? ...nah who am I kidding",
                        "There's always the salvos mate",
                        "Time to check the couch cushions for change",
                        "Shazza's mum might lend ya a twenty",
                        "Guess it's 2-minute noodles again this week"
                    ];
                    bot.sendMessage(suggestions[Math.floor(Math.random() * suggestions.length)]);
                }
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Centrelink command error:', error);
            bot.sendMessage('Centrelink computer crashed. Standard Monday really.');
            return { success: false };
        }
    }
});