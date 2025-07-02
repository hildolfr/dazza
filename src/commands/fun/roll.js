import { Command } from '../base.js';

// Single dice responses
const singleDiceResponses = {
    veryLow: [
        "rolled a pathetic fuckin {roll}, just like your performance in bed",
        "rolled {roll}... that's smaller than your dick mate",
        "rolled a dogshit {roll}, ya unlucky cunt",
        "rolled {roll}, bout as useful as tits on a bull",
        "rolled a fuckin {roll}, lower than your chances of getting laid",
        "rolled {roll}... fuck me dead, that's shithouse",
        "rolled a pissweak {roll}, go have a cone and try again",
        "rolled {roll}, that's more disappointing than your missus",
        "rolled a fuckin {roll}, couldn't get lucky in a brothel could ya",
        "rolled {roll}... that's weaker than my morning glory after 50 bongs"
    ],
    low: [
        "rolled a mediocre {roll}, just like everything else in your life",
        "rolled {roll}, bout as average as your root game",
        "rolled a {roll}, meh... seen bigger",
        "rolled {roll}, that's what she said when she saw your knob",
        "rolled a fuckin {roll}, not terrible but nothing to brag about",
        "rolled {roll}, like a quickie - over before it started",
        "rolled a {roll}, bout as exciting as missionary with the lights off",
        "rolled {roll}, middle of the road like your missus",
        "rolled a fuckin {roll}, won't win ya any prizes mate",
        "rolled {roll}, that's about as thrilling as dry humping"
    ],
    high: [
        "rolled a ripper {roll}! Someone's getting their dick wet tonight!",
        "rolled {roll}! Fuck yeah, that's a proper roll cunt!",
        "rolled a massive {roll}, compensating for something are we?",
        "rolled {roll}! That's bigger than the bulge in my stubbies!",
        "rolled a fuckin beauty {roll}! Time to crack a tinnie!",
        "rolled {roll}! That's what I call big dick energy!",
        "rolled a {roll}, now that's a roll worth bragging about!",
        "rolled {roll}! Shazza would be impressed with that performance!",
        "rolled a fucking {roll}! Someone's been practicing their wrist action!",
        "rolled {roll}! That's harder than my morning wood after a dry spell!"
    ],
    special: {
        69: [
            "rolled 69! Nice! Time for some mutual oral satisfaction!",
            "rolled a fuckin 69! The sex number! You dirty bastard!",
            "rolled 69! Dinner for two, know what I mean? *wink wink*"
        ],
        420: [
            "rolled 420! Blaze it cunt! Time to punch some cones!",
            "rolled a fuckin 420! Pass the billy mate!",
            "rolled 420! The sacred number! Light one up for Dazza!"
        ]
    }
};

// Multiple dice responses
const multiDiceResponses = {
    snakeEyes: [
        "rolled snake eyes! Your luck's drier than Shazza's snatch!",
        "rolled fuckin snake eyes! That's rougher than sandpaper on your knob!",
        "rolled snake eyes! Unluckier than walking in on your parents rooting!"
    ],
    veryLow: [
        "rolled {rolls} = {total}. That's a limp dick result if I ever saw one",
        "rolled {rolls} = {total}. Lower than my standards after 20 beers",
        "rolled {rolls} = {total}. Fuck me, did you roll with your eyes closed?",
        "rolled {rolls} = {total}. That's more pathetic than a two pump chump",
        "rolled {rolls} = {total}. Shithouse rolls mate, absolutely shithouse",
        "rolled {rolls} = {total}. Those dice hate you more than your ex",
        "rolled {rolls} = {total}. That's sadder than a wank with no porn",
        "rolled {rolls} = {total}. Lower than my ballsack in summer",
        "rolled {rolls} = {total}. Those rolls are softer than a whiskey dick",
        "rolled {rolls} = {total}. That's about as useful as a cock flavoured lollipop"
    ],
    average: [
        "rolled {rolls} = {total}. Pretty average, like your bedroom performance",
        "rolled {rolls} = {total}. Middle of the road, just like vanilla sex",
        "rolled {rolls} = {total}. Not bad, not great, just like your missus",
        "rolled {rolls} = {total}. That's what I call aggressively mediocre",
        "rolled {rolls} = {total}. About as exciting as a handjob with gloves on",
        "rolled {rolls} = {total}. Standard result for a standard bloke",
        "rolled {rolls} = {total}. Neither here nor there, like a semi",
        "rolled {rolls} = {total}. That's about as thrilling as scheduled sex",
        "rolled {rolls} = {total}. Average rolls for an average root rat",
        "rolled {rolls} = {total}. Not gonna win any awards with that mate"
    ],
    high: [
        "rolled {rolls} = {total}! Now that's what I call big dick rolls!",
        "rolled {rolls} = {total}! Fuck yeah! Someone's compensating well!",
        "rolled {rolls} = {total}! Those dice are harder than me at a strip club!",
        "rolled {rolls} = {total}! That's a result worth bragging about at the pub!",
        "rolled {rolls} = {total}! Higher than me after a weekend sesh!",
        "rolled {rolls} = {total}! Those rolls are thicker than my morning wood!",
        "rolled {rolls} = {total}! Someone's been sacrificing virgins to the dice gods!",
        "rolled {rolls} = {total}! That's more impressive than lasting 5 minutes!",
        "rolled {rolls} = {total}! Massive rolls! Your dice game is strong!",
        "rolled {rolls} = {total}! That's what peak performance looks like!"
    ],
    allSame: [
        "rolled {rolls} = {total}! All the same! That's rarer than finding a virgin at schoolies!",
        "rolled {rolls} = {total}! Matching numbers! Like synchronized orgasms!",
        "rolled {rolls} = {total}! All identical! That's some tantric dice magic!"
    ]
};

export default new Command({
    name: 'roll',
    aliases: ['dice'],
    description: 'Roll dice',
    usage: '!roll [XdY]',
    category: 'fun',
    cooldown: 2000,
    
    async handler(bot, message, args) {
        let dice = 1;
        let sides = 6;
        
        if (args[0]) {
            const match = args[0].match(/^(\d+)?d(\d+)$/i);
            if (match) {
                dice = parseInt(match[1]) || 1;
                sides = parseInt(match[2]);
                
                if (dice > 100 || sides > 1000) {
                    bot.sendMessage(message.roomId, 'fuck off with those massive dice');
                    return { success: true };
                }
            }
        }
        
        let total = 0;
        const rolls = [];
        
        for (let i = 0; i < dice; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }
        
        // Helper function to get random response
        const getRandomResponse = (responses) => {
            return responses[Math.floor(Math.random() * responses.length)];
        };
        
        let response;
        
        if (dice === 1) {
            // Check for special numbers first
            if (singleDiceResponses.special[total]) {
                response = getRandomResponse(singleDiceResponses.special[total]);
            } else {
                // Determine response category based on dice sides and roll
                const percentage = (total / sides) * 100;
                
                if (percentage <= 20) {
                    response = getRandomResponse(singleDiceResponses.veryLow);
                } else if (percentage <= 50) {
                    response = getRandomResponse(singleDiceResponses.low);
                } else {
                    response = getRandomResponse(singleDiceResponses.high);
                }
            }
            
            response = response.replace('{roll}', total);
            bot.sendMessage(message.roomId, `${message.username} ${response}`);
        } else {
            // Multiple dice logic
            const rollsStr = rolls.join(', ');
            const maxPossible = dice * sides;
            const percentage = (total / maxPossible) * 100;
            
            // Check for snake eyes (all 1s on 2d6)
            if (dice === 2 && sides === 6 && total === 2) {
                response = getRandomResponse(multiDiceResponses.snakeEyes);
            } 
            // Check if all dice are the same
            else if (rolls.every(r => r === rolls[0])) {
                response = getRandomResponse(multiDiceResponses.allSame);
            }
            // Check for special totals
            else if (total === 69 || total === 420) {
                response = total === 69 
                    ? getRandomResponse(singleDiceResponses.special[69])
                    : getRandomResponse(singleDiceResponses.special[420]);
            }
            // Regular percentage-based responses
            else if (percentage <= 25) {
                response = getRandomResponse(multiDiceResponses.veryLow);
            } else if (percentage <= 60) {
                response = getRandomResponse(multiDiceResponses.average);
            } else {
                response = getRandomResponse(multiDiceResponses.high);
            }
            
            response = response.replace('{rolls}', rollsStr).replace('{total}', total);
            bot.sendMessage(message.roomId, `${message.username} ${response}`);
        }
        
        return { success: true };
    }
});