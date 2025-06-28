import { Command } from '../base.js';

// Australian race horses and dogs with bogan names
const horseNames = [
    "Shazza's Revenge", "Durry Breath", "Goon Sack Glory", "Servo Slammer",
    "Centrelink Special", "Bogan's Pride", "Thong Thrower", "Ute Destroyer",
    "VB Velocity", "Bunnings Bandit", "Dole Bludger", "Pie Floater",
    "Stubby Holder", "Barbie Burner", "Bottlo Runner", "Maccas Muncher",
    "Winnie Blue", "Tradie's Dream", "Pokies Prince", "She'll Be Right"
];

const dogNames = [
    "Cone Ripper", "Bong Water", "Pub Fighter", "Ciggie Butt",
    "Goon Bag Gary", "Flamin' Galah", "Snag Stealer", "Beer Gut Billy",
    "Dero Dog", "Mullet Master", "Thong Biter", "Servo Sniffer",
    "Tinnie Terror", "Eshay Express", "Bottlo Bandit", "Kebab Krusher"
];

// Track names for variety
const tracks = {
    horse: ["Flemington", "Randwick", "Moonee Valley", "Caulfield", "Rosehill"],
    dog: ["Wentworth Park", "The Gardens", "Sandown Park", "Albion Park", "The Meadows"]
};

// Race outcomes with crude commentary
const raceOutcomes = {
    win: [
        "FUCKIN' BEAUTY! {animal} wins by a nose! Ya lucky bastard!",
        "GET IN! {animal} takes it! Time to hit the bottlo with ya winnings!",
        "YEEEEW! {animal} comes from behind like me after 10 beers! You win!",
        "Fuckin' oath! {animal} smashes it harder than dazza's missus! Winner!",
        "RIPPER! {animal} wins it! Better than a blowie behind the servo!"
    ],
    place: [
        "Close one! {animal} comes {position} - ya get half ya bet back like a half-hearted handy",
        "Not bad! {animal} places {position} - enough for a few tinnies at least",
        "{animal} manages {position} place - better than a kick in the dick",
        "Decent effort! {animal} gets {position} - like finding a tenner in ya trackie dacks"
    ],
    lose: [
        "Fuckin' useless! {animal} runs like they're carrying me beer gut",
        "Christ! {animal} comes dead last - slower than me getting off the couch",
        "{animal} pulls up lame - probably been on the piss like me",
        "Absolute shocker! {animal} runs like they've had 20 cones before the race",
        "{animal} gives up halfway - must've seen the TAB odds",
        "Pathetic! {animal} finishes so far back they're still running",
        "{animal} trips over their own feet - drunk as a skunk"
    ]
};

export default new Command({
    name: 'tab',
    aliases: ['bet', 'punt', 'racing'],
    description: 'Bet on the horses or dogs at the TAB',
    usage: '!tab <amount> [horse|dog]',
    examples: [
        '!tab 10 - Bet $10 on a random horse race',
        '!tab 20 dog - Bet $20 on the dogs',
        '!tab 50 horse - Bet $50 on the horses'
    ],
    category: 'economy',
    cooldown: 7200000, // 2 hour cooldown
    cooldownMessage: 'mate the stewards are still draggin\' the dead horse off the track, come back in {time}s',
    pmAccepted: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendMessage('TAB machine\'s fucked mate, try again later');
                return { success: false };
            }

            // Check if user has provided amount
            const amount = parseInt(args[0]);
            if (!amount || amount < 1) {
                bot.sendMessage(`oi -${message.username}, gotta tell me how much to bet ya drongo! Like: !tab 20`);
                return { success: false };
            }

            // Determine race type
            const raceType = args[1]?.toLowerCase() || 'horse';
            if (!['horse', 'dog'].includes(raceType)) {
                bot.sendMessage(`-${message.username} mate, it's either 'horse' or 'dog', not whatever the fuck "${args[1]}" is`);
                return { success: false };
            }

            // Get user balance
            const userEcon = await bot.heistManager.getUserBalance(message.username);
            if (userEcon.balance < amount) {
                const insults = [
                    `ya broke cunt -${message.username}, ya only got $${userEcon.balance}`,
                    `-${message.username} ya can't bet $${amount} when ya only got $${userEcon.balance} ya numpty`,
                    `mate -${message.username}, check ya pockets - only $${userEcon.balance} in there`,
                    `fuckin' dreamin -${message.username}! ya need $${amount - userEcon.balance} more`
                ];
                bot.sendMessage(insults[Math.floor(Math.random() * insults.length)]);
                return { success: false };
            }

            // Maximum bet check
            const maxBet = Math.min(500, userEcon.balance);
            if (amount > maxBet) {
                bot.sendMessage(`steady on -${message.username}, max bet is $${maxBet} - this ain't Crown Casino`);
                return { success: false };
            }

            // Deduct bet amount
            await bot.heistManager.updateUserEconomy(message.username, -amount, 0);

            // Select animals and track
            const animalList = raceType === 'horse' ? horseNames : dogNames;
            const selectedAnimals = [];
            const usedIndexes = new Set();
            
            // Pick 6 random animals
            while (selectedAnimals.length < 6) {
                const index = Math.floor(Math.random() * animalList.length);
                if (!usedIndexes.has(index)) {
                    usedIndexes.add(index);
                    selectedAnimals.push(animalList[index]);
                }
            }

            const track = tracks[raceType][Math.floor(Math.random() * tracks[raceType].length)];
            const raceNumber = Math.floor(Math.random() * 8) + 1;

            // Public acknowledgment only
            const publicAcknowledgments = [
                `🏇 -${message.username} placed $${amount} on the ${raceType}s at ${track}, race ${raceNumber} - check ya PMs for the race!`,
                `🎰 -${message.username} is punting $${amount} at the TAB, PMing the race results`,
                `📢 Bet placed for -${message.username}! $${amount} on race ${raceNumber}, results via PM`,
                `🏁 -${message.username} backs the ${raceType}s with $${amount}, I'll PM ya the action`
            ];
            
            bot.sendMessage(publicAcknowledgments[Math.floor(Math.random() * publicAcknowledgments.length)]);

            // Build PM with full race experience
            let pmMessage = `🏇 **RACE ${raceNumber} AT ${track.toUpperCase()}**\n\n`;
            pmMessage += `**Field:**\n`;
            
            // Show the field with odds
            const fieldWithOdds = selectedAnimals.map((animal, i) => {
                const odds = Math.floor(Math.random() * 15) + 2; // 2:1 to 16:1
                return `${i + 1}. ${animal} (${odds}:1)`;
            });
            
            fieldWithOdds.forEach(entry => {
                pmMessage += `${entry}\n`;
            });
            
            // User's selection (random)
            const userPick = Math.floor(Math.random() * 6);
            const userAnimal = selectedAnimals[userPick];
            
            pmMessage += `\n**You backed:** #${userPick + 1} ${userAnimal} with $${amount}\n\n`;
            pmMessage += `*They're loading into the gates...*\n\n`;
            
            // Race start
            const raceStarts = [
                "AND THEY'RE OFF! 🏃",
                "THEY'RE RACING! 🏁",
                "AND AWAY THEY GO! 💨",
                "BUNDY'S HAD THE GUN AND THEY'RE OFF! 🔫"
            ];
            pmMessage += raceStarts[Math.floor(Math.random() * raceStarts.length)] + "\n\n";
            
            // Mid-race commentary
            const midRaceComments = [
                `${selectedAnimals[0]} leads by a length! ${selectedAnimals[1]} chasing hard!`,
                `It's neck and neck between ${selectedAnimals[2]} and ${selectedAnimals[3]}!`,
                `${selectedAnimals[4]} making a move on the outside!`,
                `OH! ${selectedAnimals[5]} nearly trips over! Still in it though!`,
                `${userAnimal} running like they stole something!`
            ];
            pmMessage += midRaceComments[Math.floor(Math.random() * midRaceComments.length)] + "\n\n";
            
            // Determine race outcome
            const outcome = Math.random();
            let winnings = 0;
            
            // 20% chance to win, 30% chance to place (2nd/3rd), 50% chance to lose
            if (outcome < 0.20) {
                // WIN!
                const odds = Math.floor(Math.random() * 8) + 3; // 3:1 to 10:1
                winnings = amount * odds;
                const resultMessage = raceOutcomes.win[Math.floor(Math.random() * raceOutcomes.win.length)]
                    .replace('{animal}', userAnimal);
                
                pmMessage += resultMessage + "\n\n";
                pmMessage += `💰 **YOU WIN $${winnings}!** (${odds}:1 odds)\n`;
                pmMessage += `Not bad for a degenerate gambler!\n`;
                
                await bot.heistManager.updateUserEconomy(message.username, winnings, 1);
                
            } else if (outcome < 0.50) {
                // PLACE (2nd or 3rd)
                const position = outcome < 0.35 ? "2nd" : "3rd";
                winnings = Math.floor(amount * 0.5); // Get half back
                const resultMessage = raceOutcomes.place[Math.floor(Math.random() * raceOutcomes.place.length)]
                    .replace('{animal}', userAnimal)
                    .replace('{position}', position);
                
                pmMessage += resultMessage + "\n\n";
                pmMessage += `🥈 **PLACED ${position.toUpperCase()}!** You get $${winnings} back.\n`;
                pmMessage += `Better than nothin!\n`;
                
                await bot.heistManager.updateUserEconomy(message.username, winnings, 0);
                
            } else {
                // LOSE
                const resultMessage = raceOutcomes.lose[Math.floor(Math.random() * raceOutcomes.lose.length)]
                    .replace('{animal}', userAnimal);
                
                pmMessage += resultMessage + "\n\n";
                
                const loseInsults = [
                    `There goes your $${amount}, straight into the bookie's pocket!`,
                    `You lost $${amount}! Should've spent it on tinnies instead`,
                    `Unlucky mate, that's $${amount} down the shitter!`,
                    `Kiss your $${amount} goodbye! The house always wins`,
                    `Your $${amount} is gone faster than a six-pack at a barbie`
                ];
                pmMessage += `❌ **LOST!** ${loseInsults[Math.floor(Math.random() * loseInsults.length)]}\n`;
            }
            
            // Add balance info
            const newBalance = await bot.heistManager.getUserBalance(message.username);
            pmMessage += `\n💵 **Balance: $${newBalance.balance}**`;
            
            // Send PM with full race experience
            bot.sendPrivateMessage(message.username, pmMessage);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('TAB command error:', error);
            bot.sendMessage('TAB machine just ate ya money and caught fire. typical.');
            return { success: false };
        }
    }
});