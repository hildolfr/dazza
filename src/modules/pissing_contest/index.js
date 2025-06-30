import { getRandomCharacteristic, shouldForceCommentary } from './characteristics.js';
import { getRandomCondition, applyConditionEffects, isFailureCondition, getConditionByName } from './conditions.js';
import { getRandomLocation, applyLocationEffects, checkLocationEvents } from './locations.js';
import { getRandomWeather, applyWeatherEffects, formatWeather, checkWeatherEvents, getComboEffects } from './weather.js';
import { normalizeUsernameForDb } from '../../utils/usernameNormalizer.js';

export class PissingContestManager {
    constructor(bot) {
        this.bot = bot;
        this.db = bot.db;
        this.activeChallenges = new Map(); // challenger -> challenge data
        this.cooldowns = new Map(); // username -> timestamp
    }

    // Check if user is on cooldown
    checkCooldown(username) {
        const lastPlayed = this.cooldowns.get(username);
        if (!lastPlayed) return { allowed: true };
        
        const timeSince = Date.now() - lastPlayed;
        const cooldownTime = 5 * 60 * 1000; // 5 minutes
        
        if (timeSince < cooldownTime) {
            const remaining = Math.ceil((cooldownTime - timeSince) / 1000);
            return { allowed: false, remaining };
        }
        
        return { allowed: true };
    }

    // Create a new challenge
    async createChallenge(challenger, challenged, amount) {
        // Normalize usernames
        const normalizedChallenger = await normalizeUsernameForDb(this.bot, challenger);
        const normalizedChallenged = await normalizeUsernameForDb(this.bot, challenged);
        
        // Check cooldown
        const cooldown = this.checkCooldown(normalizedChallenger);
        if (!cooldown.allowed) {
            return {
                success: false,
                message: `still shakin it off mate, wait ${cooldown.remaining}s`
            };
        }
        
        // Check if challenger has active challenge
        if (this.activeChallenges.has(normalizedChallenger)) {
            return {
                success: false,
                message: "ya already got ya dick out mate, finish that contest first"
            };
        }
        
        // Check balance if betting money
        if (amount > 0) {
            const balance = await this.bot.heistManager.getUserBalance(challenger);
            if (balance.balance < amount) {
                return {
                    success: false,
                    message: `ya need $${amount} to piss mate, you've only got $${balance.balance}`
                };
            }
        }
        
        // Create challenge
        const challenge = {
            challenger: normalizedChallenger,
            challenged: normalizedChallenged,
            amount,
            created_at: Date.now(),
            expires_at: Date.now() + 30000, // 30 second timeout
            status: 'pending'
        };
        
        // Store challenge
        this.activeChallenges.set(normalizedChallenger, challenge);
        
        // Set timeout to expire challenge
        setTimeout(() => {
            if (this.activeChallenges.get(normalizedChallenger)?.status === 'pending') {
                this.activeChallenges.delete(normalizedChallenger);
                this.bot.sendMessage(`-${challenger} got stood up! Nobody wants to see that tiny thing`);
            }
        }, 30000);
        
        return {
            success: true,
            challenge
        };
    }

    // Find challenge where user is the challenged party
    findChallengeForUser(username) {
        const normalized = username.toLowerCase();
        for (const [challenger, challenge] of this.activeChallenges.entries()) {
            if (challenge.challenged.toLowerCase() === normalized && challenge.status === 'pending') {
                return challenge;
            }
        }
        return null;
    }

    // Accept a challenge
    async acceptChallenge(username) {
        const challenge = this.findChallengeForUser(username);
        if (!challenge) {
            return {
                success: false,
                message: "no one's challenged ya to whip it out mate"
            };
        }
        
        // Check cooldown for challenged player
        const cooldown = this.checkCooldown(challenge.challenged);
        if (!cooldown.allowed) {
            return {
                success: false,
                message: `still recoverin from last time, wait ${cooldown.remaining}s`
            };
        }
        
        // Check balance if betting money
        if (challenge.amount > 0) {
            const balance = await this.bot.heistManager.getUserBalance(username);
            if (balance.balance < challenge.amount) {
                this.activeChallenges.delete(challenge.challenger);
                return {
                    success: false,
                    message: `ya need $${challenge.amount} to accept mate, you've only got $${balance.balance}`
                };
            }
        }
        
        // Mark as accepted
        challenge.status = 'accepted';
        challenge.accepted_at = Date.now();
        
        // Start the contest
        return await this.runContest(challenge);
    }

    // Decline a challenge
    async declineChallenge(username) {
        const challenge = this.findChallengeForUser(username);
        if (!challenge) {
            return {
                success: false,
                message: "no one's challenged ya mate"
            };
        }
        
        // Remove challenge
        this.activeChallenges.delete(challenge.challenger);
        
        return {
            success: true,
            message: `-${username} pussied out! Kept it in their pants like a coward`
        };
    }

    // Run the actual contest
    async runContest(challenge) {
        const { challenger, challenged, amount } = challenge;
        
        // Remove from active challenges
        this.activeChallenges.delete(challenger);
        
        // Set cooldowns
        this.cooldowns.set(challenger, Date.now());
        this.cooldowns.set(challenged, Date.now());
        
        // Quick acceptance message
        const acceptMessages = [
            "it's on cunts!",
            "dicks out boys!",
            "let's fuckin go!",
            "you're gonna lose mate!",
            "whip em out lads!"
        ];
        this.bot.sendMessage(acceptMessages[Math.floor(Math.random() * acceptMessages.length)]);
        
        // Roll characteristics
        const challengerChar = getRandomCharacteristic();
        const challengedChar = getRandomCharacteristic();
        
        // Roll location and weather
        const location = getRandomLocation();
        const weather = getRandomWeather();
        
        // Roll conditions early for announcement
        let challengerCondition = challengerChar.self_condition ? getConditionByName(challengerChar.self_condition) : getRandomCondition();
        let challengedCondition = challengedChar.self_condition ? getConditionByName(challengedChar.self_condition) : getRandomCondition();
        
        // Handle mutual conditions
        if (challengerChar.mutual_condition) {
            const mutual = getConditionByName(challengerChar.mutual_condition);
            challengerCondition = mutual;
            challengedCondition = mutual;
        }
        if (challengedChar.mutual_condition) {
            const mutual = getConditionByName(challengedChar.mutual_condition);
            challengerCondition = mutual;
            challengedCondition = mutual;
        }
        
        // Store conditions in challenge for later use
        challenge.challengerCondition = challengerCondition;
        challenge.challengedCondition = challengedCondition;
        
        // Build announcement after brief delay
        setTimeout(() => {
            this.announceMatchup(challenger, challenged, challengerChar, challengedChar, location, weather, amount, challengerCondition, challengedCondition);
        }, 1500);
        
        // Show single waiting message during contest
        setTimeout(() => {
            const waitingMessages = [
                "*unzipping sounds*",
                "*water hitting pavement*",
                "*aggressive grunting*",
                "I can hear the streams from here...",
                "Someone's having stage fright...",
                "*zipper stuck*",
                "This is taking forever...",
                "*whistling nervously*",
                "Shazza's gonna be pissed about this...",
                "*the sound of splashing intensifies*",
                "Oi! You cunts better not be pissin on me car!",
                "*someone's humming nervously*",
                "I think I hear sirens...",
                "*awkward silence except for piss sounds*",
                "This is gettin weird...",
                "*competitive grunting noises*",
                "Someone's really pushin it out there",
                "*the crowd goes silent*",
                "Is that steam I see?",
                "*nervous laughter from onlookers*",
                "Fuckin hell, the smell...",
                "*someone yells 'PUSH!'*",
                "I can't watch but I can't look away...",
                "*dramatic music plays from someone's phone*",
                "This is why we can't have nice things",
                "*someone's definitely cheating*",
                "Oi that's not fair, he's using both hands!",
                "*the sound of a belt buckle hitting concrete*",
                "Someone call Guinness Book of Records",
                "*distant police sirens*",
                "Quick! Someone's comin!",
                "*the sound of pure concentration*",
                "You could cut the tension with a knife",
                "*someone slips in their own piss*",
                "This is gettin out of hand...",
                "*a dog starts barking at the scene*",
                "Even the local wildlife is disturbed",
                "*someone's phone rings mid-stream*",
                "Not now mum!",
                "*the sound of victory approaching*",
                "I think we have a winner...",
                "*desperate last second pushing*",
                "It's gonna be close!",
                "*someone's clearly dehydrated*",
                "Should've had more beers mate",
                "*the ground is becoming a lake*",
                "Watch your step everyone!",
                "*competitive trash talking*",
                "Ya call that a stream?",
                "*someone's trying the helicopter technique*",
                "Show off!",
                "*the smell of asparagus*",
                "What the fuck did you eat?",
                "*someone's stream is going sideways*",
                "Physics has left the chat",
                "*both contestants are red-faced*",
                "Don't pass out lads!",
                "*someone accidentally hits a car*",
                "That's gonna leave a mark...",
                "*the sound of pure determination*",
                "This is what peak performance looks like"
            ];
            this.bot.sendMessage(waitingMessages[Math.floor(Math.random() * waitingMessages.length)]);
        }, 15000);
        
        // Calculate results after 30 seconds
        setTimeout(async () => {
            await this.calculateAndAnnounceResults(challenge, challengerChar, challengedChar, location, weather);
        }, 30000);
        
        return { success: true };
    }

    // Announce the matchup
    announceMatchup(challenger, challenged, charA, charB, location, weather, amount, conditionA, conditionB) {
        // Check if both have conditions for two-line format
        const bothHaveConditions = conditionA && conditionB;
        
        // Build announcement with new format
        let announcement = `💦 -${challenger} '${charA.name}'`;
        
        // Add challenger condition inline if only one has condition
        if (conditionA && !bothHaveConditions) {
            announcement += ` [*${conditionA.name}*]`;
        }
        
        announcement += ` vs -${challenged} '${charB.name}'`;
        
        // Add challenged condition inline if only one has condition
        if (conditionB && !bothHaveConditions) {
            announcement += ` [*${conditionB.name}*]`;
        }
        
        // Add location (shortened name)
        const shortLocation = location.name.replace('Car Park', '').replace('The ', '').trim();
        announcement += ` @ ${shortLocation}`;
        
        // Add bet info
        if (amount > 0) {
            announcement += ` $${amount}`;
        } else {
            announcement += ` 🏆`;
        }
        
        this.bot.sendMessage(announcement);
        
        // If both have conditions, announce them on second line
        if (bothHaveConditions) {
            setTimeout(() => {
                this.bot.sendMessage(`Conditions: -${challenger} [*${conditionA.name}*], -${challenged} [*${conditionB.name}*]`);
            }, 500);
        }
        
        // Announce weather after brief delay
        setTimeout(() => {
            this.bot.sendMessage(`${formatWeather(weather)} - ${weather.special ? weather.special.message : location.description}`);
        }, bothHaveConditions ? 2000 : 1500);
        
        // Force commentary for certain matchups
        if (shouldForceCommentary(charA, charB)) {
            setTimeout(() => {
                this.addDazzaCommentary(charA, charB);
            }, bothHaveConditions ? 3500 : 3000);
        } else if (Math.random() < 0.4) {
            // 40% chance for random generic commentary
            setTimeout(() => {
                this.addRandomDazzaCommentary();
            }, bothHaveConditions ? 3500 : 3000);
        }
    }

    // Calculate contest results
    async calculateAndAnnounceResults(challenge, charA, charB, location, weather) {
        const { challenger, challenged, amount } = challenge;
        
        // Get bladder states
        const challengerBladder = await this.getBladderState(challenger);
        const challengedBladder = await this.getBladderState(challenged);
        
        // Calculate base stats for each player
        let challengerStats = this.calculateBaseStats(challengerBladder);
        let challengedStats = this.calculateBaseStats(challengedBladder);
        
        // Apply characteristic effects
        challengerStats = this.applyCharacteristicEffects(challengerStats, charA, charB);
        challengedStats = this.applyCharacteristicEffects(challengedStats, charB, charA);
        
        // Use conditions that were already rolled and stored
        const challengerCondition = challenge.challengerCondition;
        const challengedCondition = challenge.challengedCondition;
        
        // Check for instant failures
        const challengerFailed = isFailureCondition(challengerCondition);
        const challengedFailed = isFailureCondition(challengedCondition);
        
        if (challengerFailed || challengedFailed) {
            await this.handleFailures(challenge, challengerFailed, challengedFailed, challengerCondition, challengedCondition);
            return;
        }
        
        // Apply condition effects
        challengerStats = applyConditionEffects(challengerStats, challengerCondition);
        challengedStats = applyConditionEffects(challengedStats, challengedCondition);
        
        // Apply location effects
        challengerStats = applyLocationEffects(challengerStats, location, { characteristic: charA });
        challengedStats = applyLocationEffects(challengedStats, location, { characteristic: charB });
        
        // Apply weather effects
        const challengerWindSailor = charA.name === "Wind Sailor";
        const challengedWindSailor = charB.name === "Wind Sailor";
        challengerStats = applyWeatherEffects(challengerStats, weather, challengerWindSailor);
        challengedStats = applyWeatherEffects(challengedStats, weather, challengedWindSailor);
        
        // Calculate final scores
        const challengerScore = this.calculateScore(challengerStats);
        const challengedScore = this.calculateScore(challengedStats);
        
        // Determine winner
        const winner = challengerScore > challengedScore ? challenger : challenged;
        const loser = winner === challenger ? challenged : challenger;
        const winnerStats = winner === challenger ? challengerStats : challengedStats;
        const loserStats = winner === challenger ? challengedStats : challengerStats;
        const winnerScore = winner === challenger ? challengerScore : challengedScore;
        const loserScore = winner === challenger ? challengedScore : challengerScore;
        
        // Display results
        this.displayResults(winner, loser, winnerStats, loserStats, winnerScore, loserScore, charA, charB, challenge);
        
        // Handle money and stats
        await this.handleOutcome(challenge, winner, loser, winnerStats, loserStats, winnerScore, loserScore, charA, charB, location, weather);
        
        // Check for special events
        this.checkSpecialEvents(location, weather, challengerStats, challengedStats, challengerCondition, challengedCondition, challenger, challenged);
    }

    // Calculate base stats from bladder
    calculateBaseStats(bladderAmount) {
        // Base ranges
        let stats = {
            distance: 0.5 + Math.random() * 4.5, // 0.5m - 5m
            volume: 200 + Math.random() * 1800, // 200mL - 2000mL
            aim: 10 + Math.random() * 90, // 10% - 100%
            duration: 2 + Math.random() * 28 // 2s - 30s
        };
        
        // Apply bladder modifiers
        if (bladderAmount === 0) {
            stats.volume *= 0.5;
            stats.distance *= 0.8;
        } else {
            // Each drink adds 2% duration, 1% volume (max +100% volume at 100 drinks)
            stats.duration *= (1 + Math.min(bladderAmount * 0.02, 2));
            stats.volume *= (1 + Math.min(bladderAmount * 0.01, 1));
        }
        
        return stats;
    }

    // Apply characteristic effects
    applyCharacteristicEffects(stats, ownChar, opponentChar) {
        const newStats = { ...stats };
        
        // Apply own characteristic effects
        if (ownChar.effects) {
            for (const [key, value] of Object.entries(ownChar.effects)) {
                if (key === 'all') {
                    newStats.distance *= (1 + value / 100);
                    newStats.volume *= (1 + value / 100);
                    newStats.aim *= (1 + value / 100);
                    newStats.duration *= (1 + value / 100);
                } else if (['distance', 'volume', 'aim', 'duration'].includes(key)) {
                    newStats[key] *= (1 + value / 100);
                } else if (key === 'distance_min') {
                    newStats.distance = Math.max(newStats.distance, value);
                } else if (key === 'volume_min') {
                    newStats.volume = Math.max(newStats.volume, value);
                } else if (key === 'duration_min') {
                    newStats.duration = Math.max(newStats.duration, value);
                } else if (key === 'duration_max') {
                    newStats.duration = Math.min(newStats.duration, value);
                }
            }
        }
        
        return newStats;
    }

    // Calculate final score
    calculateScore(stats) {
        // Normalize stats to 0-1000 scale
        const distanceScore = (stats.distance / 5) * 1000;
        const volumeScore = (stats.volume / 2000) * 1000;
        const aimScore = (stats.aim / 100) * 1000;
        const durationScore = (stats.duration / 30) * 1000;
        
        // Apply weights
        const total = (distanceScore * 0.4) + (volumeScore * 0.25) + 
                     (aimScore * 0.2) + (durationScore * 0.15);
        
        return Math.round(total);
    }

    // Display contest results
    displayResults(winner, loser, winnerStats, loserStats, winnerScore, loserScore, charA, charB, challenge) {
        // Format stats
        const formatStats = (stats) => {
            return `📏${stats.distance.toFixed(1)}m 💧${Math.round(stats.volume)}mL 🎯${Math.round(stats.aim)}% ⏱️${Math.round(stats.duration)}s`;
        };
        
        // Get the correct characteristic for each player
        const winnerChar = winner === challenge.challenger ? charA : charB;
        const loserChar = winner === challenge.challenger ? charB : charA;
        
        // Winner announcement with boxing-style naming
        this.bot.sendMessage(`${formatStats(winnerStats)} **[${winnerScore}]**`);
        this.bot.sendMessage(`🏆 -${winner} '${winnerChar.name}' fuckin WINS with ${winnerScore} points!`);
        
        // Loser stats with boxing-style naming
        setTimeout(() => {
            this.bot.sendMessage(`${formatStats(loserStats)} **[${loserScore}]** - -${loser} '${loserChar.name}' got smashed!`);
        }, 1500);
        
        // Add contextual commentary
        setTimeout(() => {
            this.addContextualCommentary(winnerStats, loserStats, winnerScore, loserScore, charA, charB);
        }, 3000);
    }

    // Handle failures
    async handleFailures(challenge, challengerFailed, challengedFailed, challengerCond, challengedCond) {
        const { challenger, challenged, amount } = challenge;
        
        if (challengerFailed && challengedFailed) {
            // Check if it's the same mutual condition
            if (challengerCond.name === challengedCond.name && challengerCond.mutual) {
                // Mutual failure - announce once
                this.bot.sendMessage(`Both cunts ${challengerCond.message}!`);
                this.bot.sendMessage("No winner! What a fuckin embarrassment!");
            } else {
                // Different failures
                this.bot.sendMessage(`Both cunts failed! -${challenger} ${challengerCond.message} and -${challenged} ${challengedCond.message}!`);
                this.bot.sendMessage("No winner! What a fuckin embarrassment!");
            }
            return;
        }
        
        const winner = challengerFailed ? challenged : challenger;
        const loser = challengerFailed ? challenger : challenged;
        const loserCond = challengerFailed ? challengerCond : challengedCond;
        
        try {
            if (amount > 0) {
                await this.bot.heistManager.transferMoney(loser, winner, amount);
                this.bot.sendMessage(`💦 -${loser} ${loserCond.message}! -${winner} WINS $${amount}!`);
            } else {
            const bragMessages = [
                "What a fuckin pussy!",
                "Absolute embarrassment!",
                "Couldn't even get it out!",
                "Performance anxiety at its finest!",
                "That's just sad to watch!",
                "Better luck next time... maybe",
                "Should've stayed home!",
                "Epic fail right there!",
                "That's gonna hurt the reputation!",
                "Walk of shame incoming!",
                "Bottled it completely!",
                "Choked harder than a virgin!",
                "That's one for the history books!",
                "Legendary failure!",
                "Couldn't handle the pressure!"
            ];
                const bragMessage = bragMessages[Math.floor(Math.random() * bragMessages.length)];
                this.bot.sendMessage(`💦 -${loser} ${loserCond.message}! -${winner} WINS by default! ${bragMessage}`);
            }
            
            // Update stats
            await this.updateStats(winner, true, amount, null);
            await this.updateStats(loser, false, amount, null);
        } catch (error) {
            console.error('Error handling pissing contest failure:', error);
            this.bot.sendMessage('somethin went wrong with the payout, but the contest is done');
        }
    }

    // Handle match outcome
    async handleOutcome(challenge, winner, loser, winnerStats, loserStats, winnerScore, loserScore, charA, charB, location, weather) {
        const { amount } = challenge;
        
        try {
            // Transfer money if betting
            if (amount > 0) {
                await this.bot.heistManager.transferMoney(loser, winner, amount);
                this.bot.sendMessage(`💰 -${winner} wins $${amount} from -${loser}!`);
            }
            
            // Update stats
            await this.updateStats(winner, true, amount, winnerStats);
            await this.updateStats(loser, false, amount, loserStats);
            
            // Save match to database
            await this.saveMatch(challenge, winner, winnerStats, loserStats, winnerScore, loserScore, charA, charB, location, weather);
        } catch (error) {
            console.error('Error handling pissing contest outcome:', error);
            this.bot.sendMessage('somethin went wrong with the payout, but the contest is done');
        }
    }

    // Add Dazza commentary
    addDazzaCommentary(charA, charB) {
        const comments = {
            size_mismatch: [
                "Fuckin hell, that's David and Goliath of dicks right there",
                "Like parking a semi next to a smart car",
                "One of ya brought a knife to a sword fight",
                "That's like comparing a twig to a log",
                "Bloody hell, someone call it off, this ain't fair"
            ],
            crooked: [
                "Mate, did ya slam it in a car door?",
                "That thing's got more curves than a mountain road",
                "Looks like a question mark down there",
                "Did ya tie it in a knot or somethin?",
                "That's not a dick, that's a bloody boomerang"
            ],
            helicopter: [
                "This cunt's trying to take off",
                "Someone call air traffic control",
                "Gonna achieve liftoff at this rate",
                "Stop showin off ya tosser",
                "We get it mate, you can twirl"
            ],
            two_small: [
                "It's like watching two blokes argue over who's got the bigger clit",
                "Might need a magnifying glass for this one",
                "Battle of the buttons here",
                "This is just sad to watch",
                "Someone get these boys some pumps"
            ],
            two_huge: [
                "Jesus, someone call the council, we need bigger drains",
                "This is gonna flood the whole street",
                "Battle of the titans here",
                "RIP to whoever has to clean this up",
                "Might need sandbags for this one"
            ]
        };
        
        // Determine which commentary to use
        const bigDicks = ["The Horse Cock", "The Monster", "Donkey Dick"];
        const smallDicks = ["Pencil Dick", "Baby Carrot", "The Acorn"];
        
        let commentary;
        if ((bigDicks.some(d => charA.name.includes(d)) && smallDicks.some(d => charB.name.includes(d))) ||
            (smallDicks.some(d => charA.name.includes(d)) && bigDicks.some(d => charB.name.includes(d)))) {
            commentary = comments.size_mismatch;
        } else if (charA.name.includes("Crooked") || charB.name.includes("Crooked") || 
                   charA.name === "Bentley" || charB.name === "Bentley") {
            commentary = comments.crooked;
        } else if (charA.name === "The Helicopter" || charB.name === "The Helicopter") {
            commentary = comments.helicopter;
        } else if (smallDicks.some(d => charA.name.includes(d)) && smallDicks.some(d => charB.name.includes(d))) {
            commentary = comments.two_small;
        } else if (bigDicks.some(d => charA.name.includes(d)) && bigDicks.some(d => charB.name.includes(d))) {
            commentary = comments.two_huge;
        } else {
            return; // No special commentary
        }
        
        this.bot.sendMessage(`Dazza: "${commentary[Math.floor(Math.random() * commentary.length)]}"`);
    }

    // Add random generic Dazza commentary
    addRandomDazzaCommentary() {
        const genericComments = [
            "I've seen enough dicks for one day",
            "This is why I drink",
            "Reminds me of me dad's... wait, fuck, I didn't mean that",
            "I should've stayed home with Shazza",
            "Why do I always end up watching this shit?",
            "That's gonna haunt me dreams",
            "I need another bong after seein that",
            "Looks just like mine... when I was 12",
            "Christ, put em away already",
            "This is gettin a bit too personal",
            "I can smell it from here",
            "Someone pass me a beer, I need to forget this",
            "That's definitely infected",
            "Oi, that's the same technique I use!",
            "Fuck me, that brings back memories",
            "I'm never shakin hands with these cunts",
            "That's not how ya supposed to hold it",
            "Someone get these blokes a doctor",
            "I've seen better at the servo toilets",
            "This is worse than that time at the pub",
            "Me eyes! Me fuckin eyes!",
            "That's gonna leave a stain",
            "Why's it that color?",
            "I think I'm gonna chuck",
            "That's not natural",
            "Looks like a crime scene already",
            "This is what rock bottom looks like",
            "I need therapy after this",
            "That's gonna need antibiotics",
            "Shazza's is bigger",
            "I'm switchin to hard drugs after this",
            "That angle can't be healthy",
            "Someone call a priest",
            "This is why aliens don't visit",
            "I'm never using that car park again",
            "That's definitely gonna get infected",
            "My uncle had one like that",
            "Is that supposed to bend that way?",
            "I've seen roadkill in better shape",
            "This is why I failed health class",
            "That's a medical emergency waitin to happen",
            "Looks familiar... too familiar",
            "I'm burnin me clothes after this",
            "That's gonna traumatize the local wildlife",
            "Someone should document this for science... or evidence",
            "One's wearin a turtleneck, the other's not",
            "Looks like someone lost a fight with a rabbi",
            "That's what happens when ya parents are cheap",
            "Someone's got their winter coat on",
            "One's an anteater, one's a mushroom",
            "Someone's smugglin extra skin",
            "That's a lot of foreskin for one contest",
            "Looks like a before and after photo",
            "Someone's parents made different choices",
            "That hood's seen better days",
            "One's kosher, one ain't",
            "Someone forgot to unwrap theirs",
            "That's more skin than a chicken drumstick"
        ];
        
        this.bot.sendMessage(`Dazza: "${genericComments[Math.floor(Math.random() * genericComments.length)]}"`);
    }

    // Add contextual commentary based on results
    addContextualCommentary(winnerStats, loserStats, winnerScore, loserScore, charA, charB) {
        const comments = [];
        
        // Size mismatches
        if (winnerStats.distance > loserStats.distance * 2) {
            comments.push("Fuckin demolished em! Not even close!");
        }
        
        // Performance based
        if (winnerStats.distance > 4 && winnerStats.volume < 500) {
            comments.push("All show, fuck all flow");
        }
        
        if (winnerStats.duration > 25 && winnerStats.distance < 1) {
            comments.push("Dribbled for days but went nowhere");
        }
        
        if (winnerStats.aim > 90 && winnerStats.distance < 1) {
            comments.push("Great aim but pisses like a sheila");
        }
        
        // Close match
        if (Math.abs(winnerScore - loserScore) < 50) {
            comments.push("Fuckin close one! Could've gone either way!");
        }
        
        // Domination
        if (winnerScore > loserScore * 2) {
            comments.push("Total fuckin massacre! Embarrassing!");
        }
        
        if (comments.length > 0) {
            this.bot.sendMessage(comments[Math.floor(Math.random() * comments.length)]);
        }
    }

    // Get bladder state from database
    async getBladderState(username) {
        const normalized = await normalizeUsernameForDb(this.bot, username);
        
        try {
            const row = await this.db.get(
                'SELECT current_amount FROM user_bladder WHERE username = ?',
                [normalized]
            );
            
            return row ? row.current_amount : 0;
        } catch (error) {
            console.error('Error getting bladder state:', error);
            return 0;
        }
    }

    // Update user stats
    async updateStats(username, won, amount, stats) {
        const normalized = await normalizeUsernameForDb(this.bot, username);
        
        try {
            // Update or insert stats
            await this.db.run(`
                INSERT INTO pissing_contest_stats (username, total_matches, wins, losses, money_won, money_lost, last_played)
                VALUES (?, 1, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    total_matches = total_matches + 1,
                    wins = wins + ?,
                    losses = losses + ?,
                    money_won = money_won + ?,
                    money_lost = money_lost + ?,
                    last_played = ?
            `, [
                normalized,
                won ? 1 : 0,
                won ? 0 : 1,
                won ? amount : 0,
                won ? 0 : amount,
                Date.now(),
                won ? 1 : 0,
                won ? 0 : 1,
                won ? amount : 0,
                won ? 0 : amount,
                Date.now()
            ]);
            
            // Update best stats if winner
            if (won && stats) {
                await this.db.run(`
                    UPDATE pissing_contest_stats
                    SET best_distance = MAX(best_distance, ?),
                        best_volume = MAX(best_volume, ?),
                        best_aim = MAX(best_aim, ?),
                        best_duration = MAX(best_duration, ?)
                    WHERE username = ?
                `, [stats.distance, stats.volume, stats.aim, stats.duration, normalized]);
            }
            
            // Reset bladder
            await this.db.run(`
                UPDATE user_bladder
                SET current_amount = 0, last_piss_time = ?
                WHERE username = ?
            `, [Date.now(), normalized]);
            
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // Save match to database
    async saveMatch(challenge, winner, winnerStats, loserStats, winnerScore, loserScore, charA, charB, location, weather) {
        try {
            const loser = winner === challenge.challenger ? challenge.challenged : challenge.challenger;
            const challengerStats = winner === challenge.challenger ? winnerStats : loserStats;
            const challengedStats = winner === challenge.challenger ? loserStats : winnerStats;
            
            await this.db.run(`
                INSERT INTO pissing_contest_challenges (
                    challenger, challenged, amount, status, created_at, expires_at, completed_at,
                    winner, challenger_distance, challenger_volume, challenger_aim,
                    challenger_duration, challenger_total, challenged_distance,
                    challenged_volume, challenged_aim, challenged_duration, challenged_total,
                    challenger_characteristic, challenged_characteristic, location, weather
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                challenge.challenger, challenge.challenged, challenge.amount,
                'completed', challenge.created_at, challenge.expires_at, Date.now(), winner,
                challengerStats.distance, challengerStats.volume, challengerStats.aim,
                challengerStats.duration, winnerScore,
                challengedStats.distance, challengedStats.volume, challengedStats.aim,
                challengedStats.duration, loserScore,
                charA.name, charB.name, location.name, weather.name
            ]);
        } catch (error) {
            console.error('Error saving match:', error);
        }
    }

    // Check for special events
    checkSpecialEvents(location, weather, challengerStats, challengedStats, challengerCondition, challengedCondition, challenger, challenged) {
        // Location events
        const locationEvents = checkLocationEvents(location);
        for (const event of locationEvents) {
            if (event.type === 'fine' && event.message) {
                setTimeout(() => {
                    this.bot.sendMessage(event.message);
                }, 4500);
            }
        }
        
        // Weather events
        const weatherEvents = checkWeatherEvents(weather, challengerStats);
        for (const event of weatherEvents) {
            if (event.message) {
                setTimeout(() => {
                    this.bot.sendMessage(event.message);
                }, 5000);
            }
        }
        
        // Condition fines
        if (challengerCondition && challengerCondition.fine) {
            setTimeout(async () => {
                try {
                    await this.bot.heistManager.deductMoney(challenger, challengerCondition.fine);
                    this.bot.sendMessage(challengerCondition.fineMessage || `Medical bill! -${challenger} loses $${challengerCondition.fine}`);
                } catch (error) {
                    console.error('Error deducting fine from challenger:', error);
                    this.bot.sendMessage(`tried to fine -${challenger} but somethin went wrong`);
                }
            }, 6000);
        }
        
        if (challengedCondition && challengedCondition.fine) {
            setTimeout(async () => {
                try {
                    await this.bot.heistManager.deductMoney(challenged, challengedCondition.fine);
                    this.bot.sendMessage(challengedCondition.fineMessage || `Medical bill! -${challenged} loses $${challengedCondition.fine}`);
                } catch (error) {
                    console.error('Error deducting fine from challenged:', error);
                    this.bot.sendMessage(`tried to fine -${challenged} but somethin went wrong`);
                }
            }, 6500);
        }
    }
}