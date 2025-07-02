import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// Sign types for different businesses
const signTypes = {
    common: [
        "pizza joint advertising $5 lunch specials",
        "tax return mob promising massive refunds",
        "mattress store having another closing down sale",
        "cash for gold place offering 'best prices'",
        "phone repair shop with dodgy screens",
        "discount chemist flogging vitamins",
        "gym having a 'no joining fee' special",
        "car wash trying to get customers"
    ],
    uncommon: [
        "head shop advertising 'tobacco' pipes",
        "massage parlour with 'happy endings'",
        "liquidation sale for a failed business",
        "adult store having a discreet sale",
        "vape shop pushing the new flavours",
        "dodgy loan shark advertising quick cash",
        "underground fight club recruitment",
        "psychic reader offering life advice"
    ]
};

// Random events that can happen
const randomEvents = {
    positive: [
        "bunch of tradies honked and gave ya thumbs up",
        "some legend chucked ya a fiver from their car",
        "boss reckons you're a natural, might get more shifts",
        "hot sheila winked at ya from the traffic lights",
        "got featured on someone's tiktok, going viral",
        "found a twenty on the ground while spinning",
        "local news filmed ya for a segment on hard workers"
    ],
    negative: [
        "dropped the sign and it nearly hit a car",
        "cops hassled ya about permits for 20 minutes",
        "some dickhead threw a maccas cup at ya",
        "sign broke in half from spinning too hard",
        "nearly got clipped by a ute doing a burnout",
        "started raining and the sign got soggy",
        "karen complained you're distracting drivers"
    ],
    injury: [
        "threw out ya shoulder doing sick spins",
        "sign smacked ya in the face, bloody nose",
        "tripped over the gutter, skinned ya knee",
        "pulled a hammy trying to dance with the sign",
        "sign caught the wind and yanked ya back out",
        "got dizzy from spinning and stacked it hard",
        "repetitive strain injury from all the waving"
    ]
};

// Weather conditions affecting pay
const weatherConditions = [
    { condition: "perfect sunny day", modifier: 1.2 },
    { condition: "bit overcast but not bad", modifier: 1.0 },
    { condition: "fuckin' hot as balls", modifier: 0.9 },
    { condition: "started pissing down rain", modifier: 0.7 },
    { condition: "windy as fuck", modifier: 0.8 },
    { condition: "nice breeze keeping ya cool", modifier: 1.1 }
];

export default new Command({
    name: 'sign_spinning',
    aliases: ['sign', 'spin', 'signspinning', 'signspin'],
    description: 'Spin signs on the street corner for cash (once per 36 hours)',
    usage: '!sign_spinning',
    examples: ['!sign_spinning - Stand on the corner spinning signs for businesses'],
    category: 'economy',
    pmAccepted: true,
    persistentCooldown: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = 'No sign spinning gigs available right now mate';
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check persistent cooldown (36 hours)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 129600000); // 36 hours
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const waitMessages = [
                        `oi -${message.username}, ya arms are still fucked from last shift! ${hours}h ${minutes}m til recovery`,
                        `-${message.username} mate, can't spin signs every day or you'll do ya shoulder. Wait ${hours}h ${minutes}m`,
                        `ease up -${message.username}, the corner's taken by another spinner. Try again in ${hours}h ${minutes}m`,
                        `bloody hell -${message.username}, even sign spinning needs rest days! ${hours}h ${minutes}m to go`,
                        `-${message.username} the agency said no more shifts for ${hours}h ${minutes}m, too many spinners already`
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
            
            // Public acknowledgment
            if (!message.isPM) {
                const publicMessages = [
                    `-${message.username} is grabbing a sign and heading to the corner...`,
                    `-${message.username} is off to spin signs like a sick cunt`,
                    `-${message.username} reckons they can make motorists look at ads`,
                    `-${message.username} is about to show these signs who's boss`
                ];
                
                bot.sendMessage(message.roomId, publicMessages[Math.floor(Math.random() * publicMessages.length)]);
            }
            
            // Determine sign type (80% common, 20% uncommon)
            const signRoll = Math.random();
            const signTier = signRoll < 0.8 ? 'common' : 'uncommon';
            const signType = signTypes[signTier][Math.floor(Math.random() * signTypes[signTier].length)];
            
            // Get weather condition
            const weather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
            
            // Base pay calculation
            const basePay = signTier === 'uncommon' ? 
                Math.floor(Math.random() * 21) + 40 : // $40-60 for uncommon
                Math.floor(Math.random() * 26) + 15;  // $15-40 for common
            
            let finalPay = Math.floor(basePay * weather.modifier);
            
            // Roll for injury (10% chance)
            const injuryRoll = Math.random();
            let injured = false;
            let injuryCost = 0;
            let injuryDesc = '';
            
            if (injuryRoll < 0.10) {
                injured = true;
                injuryCost = Math.floor(Math.random() * 31); // $0-30
                injuryDesc = randomEvents.injury[Math.floor(Math.random() * randomEvents.injury.length)];
                finalPay = Math.max(0, finalPay - injuryCost);
            }
            
            // Roll for random event (40% chance if not injured)
            let eventDesc = '';
            if (!injured && Math.random() < 0.40) {
                const eventType = Math.random() < 0.6 ? 'positive' : 'negative';
                const events = randomEvents[eventType];
                eventDesc = events[Math.floor(Math.random() * events.length)];
                
                if (eventType === 'positive' && eventDesc.includes('fiver')) {
                    finalPay += 5;
                } else if (eventType === 'positive' && eventDesc.includes('twenty')) {
                    finalPay += 20;
                }
            }
            
            // Update balance
            await bot.heistManager.updateUserEconomy(message.username, finalPay, 0);
            
            // Update stats
            if (bot.db) {
                // Get current stats
                const stats = await bot.db.get(`
                    SELECT * FROM sign_spinning_stats WHERE username = ? AND room_id = ?
                `, [message.username, message.roomId || 'fatpizza']);
                
                if (stats) {
                    await bot.db.run(`
                        UPDATE sign_spinning_stats 
                        SET total_spins = total_spins + 1,
                            total_earnings = total_earnings + ?,
                            cars_hit = cars_hit + ?,
                            cops_called = cops_called + ?,
                            best_shift = CASE WHEN ? > best_shift THEN ? ELSE best_shift END,
                            worst_shift = CASE WHEN ? < worst_shift OR worst_shift = 0 THEN ? ELSE worst_shift END,
                            perfect_days = perfect_days + ?,
                            last_played = ?
                        WHERE username = ? AND room_id = ?
                    `, [
                        finalPay,
                        injured && injuryDesc.includes('hit a car') ? 1 : 0,
                        eventDesc.includes('cops') ? 1 : 0,
                        finalPay, finalPay,
                        finalPay, finalPay,
                        finalPay >= 60 ? 1 : 0,
                        Date.now(),
                        message.username,
                        message.roomId || 'fatpizza'
                    ]);
                } else {
                    await bot.db.run(`
                        INSERT INTO sign_spinning_stats 
                        (username, room_id, total_spins, total_earnings, cars_hit, cops_called, best_shift, worst_shift, perfect_days, last_played)
                        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        message.username,
                        message.roomId || 'fatpizza',
                        finalPay,
                        injured && injuryDesc.includes('hit a car') ? 1 : 0,
                        eventDesc.includes('cops') ? 1 : 0,
                        finalPay,
                        finalPay,
                        finalPay >= 60 ? 1 : 0,
                        Date.now()
                    ]);
                }
            }
            
            // Build PM message
            let pmMessage = "";
            if (injured) {
                pmMessage = `⚠️ INJURED ON THE JOB!\n`;
            } else if (finalPay >= 60) {
                pmMessage = `🎯 PERFECT SHIFT!\n`;
            } else if (finalPay >= 40) {
                pmMessage = `💰 SOLID SPINNING SESSION!\n`;
            } else {
                pmMessage = `✅ SHIFT COMPLETE!\n`;
            }
            
            pmMessage += `🪧 You spun a sign for a ${signType}\n`;
            pmMessage += `🌤️ Weather: ${weather.condition}\n`;
            
            if (injured) {
                pmMessage += `🤕 Injury: ${injuryDesc}\n`;
                pmMessage += `🏥 Medical costs: $${injuryCost}\n`;
            } else if (eventDesc) {
                pmMessage += `📰 Event: ${eventDesc}\n`;
            }
            
            pmMessage += `💵 Earned: $${finalPay}\n\n`;
            
            // Add flavor text
            if (injured) {
                pmMessage += "Fuckin' workers comp better cover this shit!";
            } else if (finalPay >= 60) {
                pmMessage += "Absolutely smashed it! Boss might hire ya full time!";
            } else if (finalPay >= 40) {
                pmMessage += "Decent day's work! The motorists couldn't ignore ya!";
            } else if (finalPay >= 20) {
                pmMessage += "Not bad for standing around like a dickhead all day!";
            } else {
                pmMessage += "Shit pay but it's better than nothing. Maybe try a busier corner next time.";
            }
            
            // Get updated balance
            const newBalance = await bot.heistManager.getUserBalance(message.username);
            pmMessage += `\n\nNew balance: $${newBalance.balance}`;
            
            // Send PM
            sendPM(bot, message.username, pmMessage, message.roomContext || message.roomId);
            
            // Public announcement for exceptional results
            if (finalPay >= 60 || injured) {
                setTimeout(() => {
                    let announcement;
                    if (injured) {
                        announcement = `🚑 OH SHIT! ${message.username} got injured sign spinning! ${injuryDesc}`;
                    } else {
                        announcement = `🪧 LEGENDARY SPINNER! ${message.username} made $${finalPay} throwing signs around like a mad cunt!`;
                    }
                    bot.sendMessage(message.roomId, announcement);
                }, 2000);
            }
            
            // Record transaction
            if (bot.db) {
                await bot.db.run(`
                    INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at)
                    VALUES (?, ?, 'sign_spinning', ?, ?, ?)
                `, [
                    message.username, 
                    finalPay, 
                    injured ? `Injured shift (${weather.condition})` : `${signTier} sign (${weather.condition})`, 
                    message.roomId || 'fatpizza',
                    Date.now()
                ]);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Sign spinning command error:', { error: error.message, stack: error.stack });
            const errorMsg = 'Sign spinning agency system crashed. Try again later mate.';
            if (message.isPM) {
                sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
            } else {
                bot.sendMessage(message.roomId, errorMsg);
            }
            return { success: false };
        }
    }
});