import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// PM rejection messages
const pmRejectionMessages = [
    "what kinda soft cunt mugs people in private? do it publicly ya coward",
    "mugging in DMs? that's not how it works ya pussy",
    "grow some balls and mug them in public like a real crim",
    "private mugging? what are ya, scared? pathetic",
    "if you're gonna rob someone, do it where everyone can see ya balls",
    "secret muggings are for weak cunts, get out there",
    "too scared to mug publicly? then you don't deserve the money"
];

// Response window messages when victim responds
const responseMessages = {
    victimDefends: [
        "-victim saw ya coming and knocked ya flat! cops fine you $-fine for attempted mugging",
        "-victim was ready! landed a perfect headbutt and you're seeing stars. $-fine fine",
        "-victim caught ya hand in their pocket and broke ya nose! hospital bill: $-fine",
        "-victim screamed 'HELP!' and the cops nabbed ya. $-fine fine for being shit at crime",
        "-victim pepper sprayed ya in the face! blinded and fined $-fine"
    ],
    victimFlees: [
        "-victim bolted like usain bolt! you trip over ya own feet. cops fine ya $-fine",
        "-victim ran screaming! attracted the cops who fine you $-fine for disturbing peace",
        "-victim legged it and you couldn't keep up ya unfit bastard. $-fine fine",
        "-victim disappeared into the crowd. cops watching the whole time, $-fine fine"
    ]
};

// Successful mug messages by amount
const successMessages = {
    small: [ // $1-20
        "you snatch $-amount from -victim's pocket while they're not looking",
        "quick grab nets you $-amount from -victim. easy money",
        "-victim didn't even notice you lifted $-amount. smooth criminal",
        "you bump into -victim and walk away $-amount richer"
    ],
    medium: [ // $21-50
        "you corner -victim in an alley and they hand over $-amount",
        "-victim coughs up $-amount rather than cop a beating",
        "threatening stance gets -victim to fork over $-amount quickly",
        "you intimidate -victim into giving you $-amount. nice work"
    ],
    large: [ // $51+
        "JACKPOT! you cleaned out -victim for $-amount! what a score!",
        "holy shit! -victim was loaded! you got $-amount!",
        "you hit the motherlode! -victim loses $-amount to your skilled mugging",
        "professional job! -victim is $-amount poorer and you're living large!"
    ]
};

// Failure messages based on trust difference
const failureMessages = {
    lowTrust: [
        "-victim laughs at your pathetic mugging attempt. cops fine you $-fine",
        "you're too sketchy, -victim sees you coming a mile away. $-fine fine",
        "-victim: 'nice try rookie'. security called, you're fined $-fine",
        "amateur hour! -victim easily avoids you. cops issue $-fine fine"
    ],
    equalTrust: [
        "-victim fights back! you both get arrested. your fine: $-fine",
        "evenly matched with -victim, cops break it up. $-fine fine for you",
        "-victim puts up a good fight. both arrested, you pay $-fine",
        "stalemate with -victim until cops arrive. $-fine fine"
    ],
    highTrust: [
        "-victim knows the streets better than you. easily avoided, fined $-fine",
        "you picked the wrong target in -victim. beaten and fined $-fine",
        "-victim's too experienced for you. cops called, $-fine fine",
        "-victim reverse mugs YOU but cops intervene. you still pay $-fine fine"
    ]
};

// Dazza reversal messages
const dazzaReversalMessages = [
    "OI! *dazza grabs -attacker by the throat* you muggin ME?! *takes $-amount*",
    "WHAT?! *dazza headbutts -attacker* I'll show you a real mugging! *steals $-amount*",
    "*dazza laughs* you serious cunt? *beats up -attacker and takes $-amount*",
    "the AUDACITY! *dazza king hits -attacker and rifles through pockets for $-amount*",
    "you picked the WRONG bogan! *dazza mugs -attacker back for $-amount*"
];

// Zero balance mockery
const brokeVictimMockery = [
    "HAHAHA -victim is so broke you mugged them down to ZERO! what a loser!",
    "you cleaned out -victim completely! they've got NOTHING left! brutal!",
    "-victim has been mugged to ZERO dollars! shouldn't have been so weak!",
    "savage! -victim is now completely BROKE thanks to your mugging!",
    "-victim account balance: $0. absolutely destroyed by -attacker!"
];

function calculateSuccessChance(attackerTrust, victimTrust, victimAFK) {
    // Base 30% chance
    let chance = 0.3;
    
    // Trust difference modifier (-20% to +20%)
    const trustDiff = attackerTrust - victimTrust;
    chance += (trustDiff / 500); // ±0.2 max
    
    // AFK bonus (+30% if victim is AFK)
    if (victimAFK) {
        chance += 0.3;
    }
    
    // Clamp between 10% and 70%
    return Math.max(0.1, Math.min(0.7, chance));
}

function calculateResponseSuccessChance(victimTrust) {
    // If victim responds, they have 70-90% chance to defend based on trust
    return 0.7 + (victimTrust / 500); // 70% at 0 trust, 90% at 100 trust
}

function calculateMugAmount(victimBalance, attackerTrust) {
    // Can steal 10-40% of victim's balance
    const percentage = 0.1 + (Math.random() * 0.3);
    
    // Trust increases max steal slightly
    const trustBonus = 1 + (attackerTrust / 200); // 1x to 1.5x
    
    let amount = Math.floor(victimBalance * percentage * trustBonus);
    
    // Cap at victim's balance
    return Math.min(amount, victimBalance);
}

function calculateFine() {
    // Police fine between $20-300
    return Math.floor(Math.random() * 281) + 20;
}

export default new Command({
    name: 'mug',
    aliases: ['rob', 'steal', 'jumped'],
    description: 'Mug another user for their hard-earned cash (2 hour cooldown)',
    usage: '!mug <username>',
    examples: [
        '!mug jimmy - Try to mug jimmy',
        '!mug dazza - Attempt to mug dazza (not recommended)'
    ],
    category: 'economy',
    pmAccepted: true,
    persistentCooldown: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = "economy system's broken, can't mug anyone right now";
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Reject PM usage harshly
            if (message.isPM) {
                const rejection = pmRejectionMessages[Math.floor(Math.random() * pmRejectionMessages.length)];
                sendPM(bot, message.username, rejection, message.roomContext || message.roomId);
                return { success: false };
            }

            if (args.length === 0) {
                bot.sendMessage(message.roomId, 'who ya muggin? specify a target - !mug <username>');
                return { success: false };
            }

            const targetUsername = args[0].toLowerCase();
            
            // Can't mug yourself
            if (targetUsername === message.username.toLowerCase()) {
                bot.sendMessage(message.roomId, `-${message.username} tries to mug themselves... what a fuckin idiot`);
                return { success: false };
            }

            // Check persistent cooldown (2 hours)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db, bot.logger);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 7200000); // 2 hours
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const cooldownMessages = [
                        `oi -${message.username}, you're too hot from your last mugging. wait ${hours}h ${minutes}m`,
                        `-${message.username} the cops are still watching you. lay low for ${hours}h ${minutes}m`,
                        `can't mug again yet -${message.username}, heat dies down in ${hours}h ${minutes}m`,
                        `-${message.username} you need ${hours}h ${minutes}m before your next crime spree`
                    ];
                    
                    bot.sendMessage(message.roomId, cooldownMessages[Math.floor(Math.random() * cooldownMessages.length)]);
                    return { success: false };
                }
            }

            // Get attacker's economy info
            const attackerEcon = await bot.heistManager.getUserBalance(message.username);
            const attackerTrust = attackerEcon.trust || 0;

            // Special handling for trying to mug dazza
            if (targetUsername === 'dazza') {
                // Very low success chance against dazza
                const dazzaChance = 0.05; // 5% chance
                const roll = Math.random();
                
                if (roll < dazzaChance) {
                    // Rare success against dazza
                    const dazzaBalance = await bot.heistManager.getUserBalance('dazza');
                    const amount = Math.min(Math.floor(Math.random() * 50) + 1, dazzaBalance.balance);
                    
                    if (amount > 0) {
                        await bot.heistManager.updateUserEconomy('dazza', -amount, 0);
                        await bot.heistManager.updateUserEconomy(message.username, amount, 5); // +5 trust for balls
                        
                        bot.sendMessage(message.roomId, `HOLY SHIT! -${message.username} actually mugged dazza for $${amount}! legendary! (-${message.username} +5 trust)`);
                        
                        // Update mug stats
                        await updateMugStats(bot.db, message.username, targetUsername, true, amount, message.roomId || 'fatpizza');
                    } else {
                        bot.sendMessage(message.roomId, `-${message.username} tried to mug dazza but he's broke as usual`);
                    }
                } else {
                    // Dazza reversal - he mugs you back
                    const userBalance = await bot.heistManager.getUserBalance(message.username);
                    const reversalAmount = Math.min(
                        Math.floor(Math.random() * 37) + 4, // $4-40
                        userBalance.balance
                    );
                    
                    if (reversalAmount > 0) {
                        await bot.heistManager.updateUserEconomy(message.username, -reversalAmount, -2); // -2 trust
                        await bot.heistManager.updateUserEconomy('dazza', reversalAmount, 0);
                        
                        let reversalMsg = dazzaReversalMessages[Math.floor(Math.random() * dazzaReversalMessages.length)];
                        reversalMsg = reversalMsg.replace('-attacker', `-${message.username}`);
                        reversalMsg = reversalMsg.replace('-amount', reversalAmount);
                        
                        bot.sendMessage(message.roomId, `${reversalMsg} (-${message.username} -2 trust)`);
                        
                        // Update stats
                        await updateMugStats(bot.db, message.username, 'dazza', false, -reversalAmount, message.roomId || 'fatpizza');
                    } else {
                        bot.sendMessage(message.roomId, `*dazza beats up -${message.username}* would've robbed ya but you're broke!`);
                        await updateMugStats(bot.db, message.username, 'dazza', false, 0, message.roomId || 'fatpizza');
                    }
                }
                
                return { success: true };
            }

            // Check if target exists in the channel
            let targetInChannel = false;
            
            // Multi-room bot check
            if (message.roomContext && message.roomContext.hasUser) {
                targetInChannel = message.roomContext.hasUser(targetUsername);
            } 
            // Single-room bot fallback
            else if (bot.userlist && bot.userlist.has) {
                targetInChannel = bot.userlist.has(targetUsername.toLowerCase());
            }
            // Alternative method for getting userlist
            else if (bot.getUserlistForRoom) {
                const userlist = bot.getUserlistForRoom(message.roomId);
                if (userlist && userlist.has) {
                    targetInChannel = userlist.has(targetUsername.toLowerCase());
                }
            }
            
            if (!targetInChannel) {
                bot.sendMessage(message.roomId, `can't find ${targetUsername} in here, they probably legged it`);
                return { success: false };
            }

            // Get victim's economy info
            const victimEcon = await bot.heistManager.getUserBalance(targetUsername);
            const victimTrust = victimEcon.trust || 0;
            
            // Check if victim is broke
            if (victimEcon.balance <= 0) {
                bot.sendMessage(message.roomId, `-${targetUsername} is already broke as fuck, nothing to mug`);
                return { success: false };
            }

            // Check if victim is AFK
            let victimAFK = false;
            
            // Multi-room bot check
            if (message.roomContext && message.roomContext.getUser) {
                const user = message.roomContext.getUser(targetUsername);
                if (user) {
                    victimAFK = user.afk === true || (user.meta && user.meta.afk === true);
                }
            }
            // Single-room bot fallback
            else if (bot.isUserAFK && typeof bot.isUserAFK === 'function') {
                victimAFK = bot.isUserAFK(targetUsername);
            }
            // Alternative method to check AFK status
            else if (bot.userlist && bot.userlist.get) {
                const user = bot.userlist.get(targetUsername.toLowerCase());
                if (user) {
                    victimAFK = user.afk === true || (user.meta && user.meta.afk === true);
                }
            }
            
            // Announce the mugging attempt (ping the victim)
            bot.sendMessage(message.roomId, `-${message.username} is trying to mug ${targetUsername}!`);
            
            // Set up response window (60 seconds)
            let victimResponded = false;
            let responseAlertSent = false;
            const responseHandler = (data) => {
                // For multi-room bot, check roomId matches
                const isCorrectRoom = data.roomId ? data.roomId === message.roomId : true;
                const isVictim = data.username && data.username.toLowerCase() === targetUsername.toLowerCase();
                
                if (isCorrectRoom && isVictim && !victimResponded) {
                    victimResponded = true;
                    if (!responseAlertSent) {
                        responseAlertSent = true;
                        const alertMessages = [
                            `oi -${targetUsername} noticed -${message.username} coming! this'll be harder now`,
                            `-${targetUsername}'s awake and alert! -${message.username} better watch out`,
                            `shit! -${targetUsername} saw ya -${message.username}! they're ready to defend`,
                            `-${targetUsername} spotted the mugging attempt! odds just turned against -${message.username}`
                        ];
                        bot.sendMessage(message.roomId, alertMessages[Math.floor(Math.random() * alertMessages.length)]);
                    }
                }
            };
            
            // Use appropriate event based on bot type
            const eventName = bot.rooms ? 'chat:message' : 'userMessage';
            bot.on(eventName, responseHandler);
            
            // Wait 60 seconds for response
            await new Promise(resolve => setTimeout(resolve, 60000));
            
            // Remove the handler
            bot.removeListener(eventName, responseHandler);
            
            // Calculate success
            let successChance = calculateSuccessChance(attackerTrust, victimTrust, victimAFK);
            
            // If victim responded, heavily favor them
            if (victimResponded) {
                successChance = 1 - calculateResponseSuccessChance(victimTrust);
                
                const roll = Math.random();
                if (roll > successChance) {
                    // Victim successfully defends
                    const attackerBalance = await bot.heistManager.getUserBalance(message.username);
                    const baseFine = calculateFine();
                    const fine = Math.min(baseFine, attackerBalance.balance); // Don't fine more than they have
                    const defenseTrustGain = Math.floor(Math.random() * 3) + 1; // 1-3 trust gain
                    
                    if (fine > 0) {
                        await bot.heistManager.updateUserEconomy(message.username, -fine, -3); // -3 trust severe penalty
                    } else {
                        await bot.heistManager.updateUserEconomy(message.username, 0, -3); // Just trust penalty if broke
                    }
                    await bot.heistManager.updateUserEconomy(targetUsername, 0, defenseTrustGain); // variable trust for defending
                    
                    let defendMsg;
                    if (fine > 0) {
                        defendMsg = responseMessages.victimDefends[Math.floor(Math.random() * responseMessages.victimDefends.length)]
                            .replace('-victim', `-${targetUsername}`)
                            .replace('-fine', fine);
                    } else {
                        defendMsg = `-${targetUsername} fought off -${message.username} who's too broke to pay the fine!`;
                    }
                    
                    bot.sendMessage(message.roomId, `${defendMsg} (-${message.username} -3 trust, -${targetUsername} +${defenseTrustGain} trust)`);
                    
                    await updateMugStats(bot.db, message.username, targetUsername, false, -fine, message.roomId || 'fatpizza');
                    return { success: true };
                }
            }
            
            // Roll for success
            const roll = Math.random();
            
            if (roll < successChance) {
                // Successful mug!
                const mugAmount = calculateMugAmount(victimEcon.balance, attackerTrust);
                
                if (mugAmount > 0) {
                    // Transfer money
                    await bot.heistManager.updateUserEconomy(targetUsername, -mugAmount, -1); // -1 trust for getting mugged
                    await bot.heistManager.updateUserEconomy(message.username, mugAmount, 2); // +2 trust for successful mug
                    
                    // Check if victim is now broke
                    const newVictimBalance = await bot.heistManager.getUserBalance(targetUsername);
                    
                    // Select appropriate message
                    let msgCategory = 'small';
                    if (mugAmount > 50) msgCategory = 'large';
                    else if (mugAmount > 20) msgCategory = 'medium';
                    
                    let successMsg = successMessages[msgCategory][Math.floor(Math.random() * successMessages[msgCategory].length)]
                        .replace('-amount', mugAmount)
                        .replace('-victim', `-${targetUsername}`);
                    
                    bot.sendMessage(message.roomId, `${successMsg} (-${message.username} +2 trust, -${targetUsername} -1 trust)`);
                    
                    // Mock if zeroed out
                    if (newVictimBalance.balance === 0) {
                        setTimeout(() => {
                            const mockMsg = brokeVictimMockery[Math.floor(Math.random() * brokeVictimMockery.length)]
                                .replace('-victim', `-${targetUsername}`)
                                .replace('-attacker', `-${message.username}`);
                            bot.sendMessage(message.roomId, mockMsg);
                        }, 2000);
                    }
                    
                    await updateMugStats(bot.db, message.username, targetUsername, true, mugAmount, message.roomId || 'fatpizza');
                }
            } else {
                // Failed mug
                const attackerBalance = await bot.heistManager.getUserBalance(message.username);
                const baseFine = calculateFine();
                const fine = Math.min(baseFine, attackerBalance.balance); // Don't fine more than they have
                
                if (fine > 0) {
                    await bot.heistManager.updateUserEconomy(message.username, -fine, -2); // -2 trust for failure
                } else {
                    await bot.heistManager.updateUserEconomy(message.username, 0, -2); // Just trust penalty if broke
                }
                
                // Select failure message based on trust levels
                let msgCategory = 'equalTrust';
                if (attackerTrust < victimTrust - 20) msgCategory = 'lowTrust';
                else if (attackerTrust > victimTrust + 20) msgCategory = 'highTrust';
                
                let failMsg;
                if (fine > 0) {
                    failMsg = failureMessages[msgCategory][Math.floor(Math.random() * failureMessages[msgCategory].length)]
                        .replace('-victim', `-${targetUsername}`)
                        .replace('-fine', fine);
                } else {
                    failMsg = `-${message.username} failed to mug -${targetUsername} and is too broke to pay the fine!`;
                }
                
                bot.sendMessage(message.roomId, `${failMsg} (-${message.username} -2 trust)`);
                
                await updateMugStats(bot.db, message.username, targetUsername, false, -fine, message.roomId || 'fatpizza');
            }

            return { success: true };
            
        } catch (error) {
            bot.logger.error('Mug command error:', { error: error.message, stack: error.stack });
            bot.sendMessage(message.roomId, 'something went wrong with the mugging');
            return { success: false };
        }
    }
});

// Helper function to update mug statistics
async function updateMugStats(db, attacker, victim, success, amount, roomId = 'fatpizza') {
    if (!db) return;
    
    try {
        const now = Date.now();
        
        // Update attacker stats (without room_id since table doesn't have it)
        await db.run(`
            INSERT INTO mug_stats (username, total_mugs, successful_mugs, failed_mugs, total_stolen, total_lost, last_played)
            VALUES (?, 1, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                total_mugs = total_mugs + 1,
                successful_mugs = successful_mugs + ?,
                failed_mugs = failed_mugs + ?,
                total_stolen = total_stolen + ?,
                total_lost = total_lost + ?,
                biggest_score = CASE WHEN ? > biggest_score THEN ? ELSE biggest_score END,
                times_arrested = times_arrested + ?,
                last_played = ?,
                updated_at = CURRENT_TIMESTAMP
        `, [
            attacker,
            success ? 1 : 0,
            success ? 0 : 1,
            success ? amount : 0,
            success ? 0 : Math.abs(amount),
            now,
            success ? 1 : 0,
            success ? 0 : 1,
            success ? amount : 0,
            success ? 0 : Math.abs(amount),
            success ? amount : 0,
            success ? amount : 0,
            success ? 0 : 1,
            now
        ]);
        
        // Update victim stats if they were successfully mugged
        if (success && victim !== 'dazza') {
            await db.run(`
                INSERT INTO mug_stats (username, times_mugged, total_lost, last_mugged_by, last_mugged_at)
                VALUES (?, 1, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    times_mugged = times_mugged + 1,
                    total_lost = total_lost + ?,
                    last_mugged_by = ?,
                    last_mugged_at = ?,
                    updated_at = CURRENT_TIMESTAMP
            `, [victim, amount, attacker, now, amount, attacker, now]);
        }
        
        // Log transaction
        await db.run(`
            INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at)
            VALUES (?, ?, 'mug', ?, ?, ?)
        `, [attacker, amount, success ? `Mugged ${victim}` : `Failed to mug ${victim}`, roomId, now]);
        
    } catch (error) {
        console.error('Failed to update mug stats:', error);
    }
}