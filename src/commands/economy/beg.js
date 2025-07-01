import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';

// PM rejection messages (harsh, telling them to grow a pair)
const pmRejectionMessages = [
    "grow a pair of balls and beg in public ya soft cunt",
    "too ashamed to beg in front of everyone? fuckin pathetic",
    "nah mate, if you're gonna beg do it where everyone can see ya shame",
    "what kind of weak prick begs in private? man up cunt",
    "scared of public humiliation? then you don't deserve shit",
    "grow some fuckin balls and beg in the channel like a real degenerate",
    "private begging? what are ya, some kind of pussy?",
    "if you can't handle the shame publicly, you can't handle the money"
];

// Dazza being broke responses (needs money for smokes)
const dazzaBrokeMessages = [
    "fuck off mate, I'm skint meself. need every cent for durries",
    "you kidding? I got $19.50 and a pack of winnie blues costs $45 these days",
    "can't spare a cent, down to me last $15 and shazza's naggin for smokes",
    "broke as a joke here too mate, scrounging for ciggie money",
    "nah get fucked, I need this for me nicotine addiction",
    "sorry cunt but I'm saving every dollar for a pouch of white ox",
    "mate I'm so broke I'm rolling butts from the ashtray",
    "can't help ya, need this cash for the servo durrie run"
];

// Success responses by trust tier
const successResponses = {
    stranger: [ // 0-20 trust
        "who the fuck are you? *throws -username some change* $-amount, now piss off",
        "*squints at -username suspiciously* don't know ya but here's $-amount",
        "never seen ya before -username but you look desperate. $-amount and fuck off",
        "*tosses $-amount at -username* there ya go random, now get lost",
        "alright stranger, $-amount but don't make this a habit -username"
    ],
    familiar: [ // 21-50 trust
        "seen ya around -username, here's $-amount. you're alright I guess",
        "-username eh? yeah you're not too bad. take $-amount mate",
        "oh it's you -username, suppose I can spare $-amount",
        "*recognizes -username* alright, $-amount for a familiar face",
        "you again -username? fine, here's $-amount but ya owe me"
    ],
    regular: [ // 51-80 trust
        "oi -username! you're one of the good cunts. here's $-amount mate",
        "-username my old mate! course I'll help ya out. $-amount coming your way",
        "anything for a regular like you -username. take $-amount and shout me later",
        "*grins at -username* always happy to help the crew. $-amount for ya",
        "no worries -username, us regulars gotta stick together. $-amount mate"
    ],
    mate: [ // 81-100 trust
        "-username! me best mate! take $-amount, what's mine is yours cunt",
        "fuckin oath -username, anything for a top bloke like you. $-amount easy",
        "-username you legend! here's $-amount, don't even think about payin me back",
        "*bear hugs -username* course mate! $-amount and there's more where that came from",
        "oi -username ya beautiful bastard! $-amount for me favorite cunt"
    ]
};

// Failure responses by trust tier
const failureResponses = {
    stranger: [
        "nah fuck off -username, don't even know ya",
        "who? -username? never heard of ya. piss off",
        "get fucked random, earn your own money -username",
        "not a chance -username, strangers get nothin from me",
        "-username can get stuffed, don't trust randoms"
    ],
    familiar: [
        "not today -username, times are tough",
        "sorry -username but I'm not feeling generous",
        "nah -username, maybe try again later",
        "-username I like ya but not that much mate",
        "can't do it -username, ask someone else"
    ],
    regular: [
        "sorry -username, even for a regular I can't today",
        "mate -username I'm tapped out, genuinely sorry",
        "wish I could -username but the missus would kill me",
        "-username you know I would but I'm broke this week",
        "not this time -username, but I owe ya one"
    ],
    mate: [
        "fuck -username, even for you I can't right now. truly sorry mate",
        "-username I'm devastated but I literally can't spare anything",
        "mate -username if I had it you'd get it, but I'm fucked",
        "-username you know I'd give ya me last dollar but I don't have one",
        "kills me to say no -username but I'm in the shit meself"
    ]
};

// Robbery responses (Dazza takes money from the user)
const robberyResponses = [
    "HOLD UP! *Dazza knees -username in the guts and takes $-amount from their wallet*",
    "OI! *Dazza shakes down -username and steals $-amount* That's for bothering me!",
    "*Dazza grabs -username by the collar* You're giving ME $-amount for wasting my time!",
    "the audacity! *Dazza pickpockets $-amount from -username* that'll teach ya",
    "*Dazza shakes -username down* $-amount tax for annoying me",
    "nice try -username but *Dazza yoinks $-amount* I need it more",
    "*reverse uno card* actually -username, Dazza's taking $-amount from YOU",
    "hold up -username *Dazza takes $-amount* that's what you get for begging"
];

// Broke user mockery messages (when user has no money to rob)
const brokeUserMockery = [
    "was gonna rob ya -username but you're broke as fuck! pathetic",
    "*checks -username's pockets* fuck all! you're poorer than me ya broke cunt",
    "can't even rob ya -username, you've got nothing! get a job",
    "*searches -username* not a cent! what a loser, can't even afford to get robbed",
    "wanted to shake ya down -username but you're skint! embarrassing",
    "*pats -username down* empty pockets? that's fuckin sad mate",
    "can't rob what ain't there -username, you're broker than a busted pokie",
    "*checks -username's wallet* mothballs! get some money before ya beg cunt"
];

function getTrustTier(trust) {
    if (trust <= 20) return 'stranger';
    if (trust <= 50) return 'familiar';
    if (trust <= 80) return 'regular';
    return 'mate';
}

function calculateSuccessChance(trust) {
    // 0 trust = 5%, 50 trust = 10%, 100 trust = 15%
    return 0.05 + (trust / 1000);
}

function calculateRobberyChance(trust) {
    // Higher chance at low trust: 0 trust = 10%, 100 trust = 2%
    return 0.10 - (trust * 0.0008);
}

function calculatePayout(trust) {
    // Base payout 0-40, scaled by trust
    const trustMultiplier = 0.5 + (trust / 200); // 0.5x to 1x multiplier
    const basePayout = Math.floor(Math.random() * 41); // 0-40
    return Math.floor(basePayout * trustMultiplier);
}

export default new Command({
    name: 'beg',
    aliases: ['panhandle', 'spare', 'sparechange'],
    description: 'Beg Dazza for some spare change (48 hour cooldown)',
    usage: '!beg',
    examples: ['!beg - Try to get some money from Dazza'],
    category: 'economy',
    pmAccepted: true,
    persistentCooldown: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = "economy system's fucked mate, try again later";
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Harsh rejection for PM usage
            if (message.isPM) {
                const rejection = pmRejectionMessages[Math.floor(Math.random() * pmRejectionMessages.length)];
                bot.sendPrivateMessage(message.username, rejection);
                return { success: false };
            }

            // Check persistent cooldown (48 hours)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 172800000); // 48 hours
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const waitMessages = [
                        `oi -${message.username}, you already begged recently. wait ${hours}h ${minutes}m ya greedy cunt`,
                        `-${message.username} fuck off, you can't beg again for ${hours}h ${minutes}m`,
                        `patience -${message.username}, no more begging for ${hours}h ${minutes}m`,
                        `-${message.username} one beg every 2 days mate, ${hours}h ${minutes}m left`
                    ];
                    
                    bot.sendMessage(message.roomId, waitMessages[Math.floor(Math.random() * waitMessages.length)]);
                    return { success: false };
                }
            }

            // Check if Dazza has less than $20
            const dazzaBalance = await bot.heistManager.getUserBalance('dazza');
            if (dazzaBalance.balance < 20) {
                const brokeMsg = dazzaBrokeMessages[Math.floor(Math.random() * dazzaBrokeMessages.length)];
                bot.sendMessage(message.roomId, brokeMsg);
                
                // Still record the attempt
                if (bot.db) {
                    await bot.db.run(`
                        INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                        VALUES (?, 0, 'beg', 'Dazza was too broke', ?)
                    `, [message.username, Date.now()]);
                }
                
                return { success: true };
            }

            // Get user's trust level
            const userEcon = await bot.heistManager.getUserBalance(message.username);
            const trust = userEcon.trust || 0;
            const trustTier = getTrustTier(trust);

            // Roll for robbery first (before success/failure)
            const robberyChance = calculateRobberyChance(trust);
            const robberyRoll = Math.random();
            
            if (robberyRoll < robberyChance) {
                // Check if user has money to rob
                if (userEcon.balance <= 0) {
                    // User is broke, mock them instead
                    const mockeryMsg = brokeUserMockery[Math.floor(Math.random() * brokeUserMockery.length)];
                    bot.sendMessage(message.roomId, mockeryMsg.replace('-username', `-${message.username}`));
                    
                    // Log the attempted robbery
                    if (bot.db) {
                        bot.logger.debug(`Attempted to rob ${message.username} but they have balance: ${userEcon.balance}`);
                        await bot.db.run(`
                            INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                            VALUES (?, 0, 'beg', 'Too broke to rob', ?)
                        `, [message.username, Date.now()]);
                    }
                    
                    return { success: true };
                } else {
                    // User has money, proceed with robbery
                    const robberyAmount = Math.min(
                        Math.floor(Math.random() * 20) + 1, // 1-20
                        userEcon.balance // Can't rob more than they have
                    );
                    
                    try {
                        // Log balance before robbery
                        bot.logger.debug(`Robbing ${message.username}: balance before=${userEcon.balance}, stealing=${robberyAmount}`);
                        
                        // Transfer money from user to Dazza
                        await bot.heistManager.updateUserEconomy(message.username, -robberyAmount, 0);
                        await bot.heistManager.updateUserEconomy('dazza', robberyAmount, 0);
                        
                        // Verify balance after robbery
                        const updatedBalance = await bot.heistManager.getUserBalance(message.username);
                        bot.logger.debug(`Robbed ${message.username}: balance after=${updatedBalance.balance}`);
                        
                        // Send robbery message
                        let robberyMsg = robberyResponses[Math.floor(Math.random() * robberyResponses.length)];
                        robberyMsg = robberyMsg.replace('-username', `-${message.username}`);
                        robberyMsg = robberyMsg.replace('-amount', robberyAmount);
                        
                        bot.sendMessage(message.roomId, robberyMsg);
                        
                        // Log the robbery
                        if (bot.db) {
                            await bot.db.run(`
                                INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                                VALUES (?, ?, 'beg', 'Robbed by Dazza for begging', ?)
                            `, [message.username, -robberyAmount, Date.now()]);
                        }
                    } catch (error) {
                        bot.logger.error('Error during robbery:', error);
                        bot.sendMessage(message.roomId, 'somethin went wrong with the robbery, lucky escape for ya');
                    }
                    
                    return { success: true };
                }
            }

            // Roll for success
            const successChance = calculateSuccessChance(trust);
            const successRoll = Math.random();
            
            if (successRoll < successChance) {
                // Success! Calculate payout
                const payout = calculatePayout(trust);
                
                if (payout > 0) {
                    // Transfer money from Dazza to user
                    await bot.heistManager.updateUserEconomy('dazza', -payout, 0);
                    await bot.heistManager.updateUserEconomy(message.username, payout, 0);
                    
                    // Get appropriate success message
                    const successMsgs = successResponses[trustTier];
                    let successMsg = successMsgs[Math.floor(Math.random() * successMsgs.length)];
                    successMsg = successMsg.replace('-username', `-${message.username}`);
                    successMsg = successMsg.replace('-amount', payout);
                    
                    bot.sendMessage(message.roomId, successMsg);
                    
                    // Log the transaction
                    if (bot.db) {
                        await bot.db.run(`
                            INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                            VALUES (?, ?, 'beg', ?, ?)
                        `, [message.username, payout, `Successful beg (${trustTier})`, Date.now()]);
                    }
                } else {
                    // Rolled success but $0 payout
                    bot.sendMessage(message.roomId, `*looks at -${message.username}* here's fuck all mate, exactly what you deserve`);
                }
            } else {
                // Failure
                const failureMsgs = failureResponses[trustTier];
                let failureMsg = failureMsgs[Math.floor(Math.random() * failureMsgs.length)];
                failureMsg = failureMsg.replace('-username', `-${message.username}`);
                
                bot.sendMessage(message.roomId, failureMsg);
                
                // Log failed attempt
                if (bot.db) {
                    await bot.db.run(`
                        INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                        VALUES (?, 0, 'beg', ?, ?)
                    `, [message.username, `Failed beg attempt (${trustTier})`, Date.now()]);
                }
            }

            return { success: true };
            
        } catch (error) {
            bot.logger.error('Beg command error:', error);
            bot.sendMessage(message.roomId, 'somethin went wrong with the begging mate');
            return { success: false };
        }
    }
});