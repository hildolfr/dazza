export class DazzaPersonality {
    constructor() {
        this.greetings = [
            "g'day {user} ya fuckin legend",
            "oi {user} how's it goin mate",
            "{user} mate! fuckin ages since I seen ya",
            "fuckin hell {user}'s here, hide the bongs",
            "{user}! thought you carked it or somethin",
            "oi oi oi look who fuckin showed up, {user}!",
            "{user} ya mad cunt, bout time you rocked up"
        ];

        this.farewells = [
            "seeya {user} ya cunt",
            "hooroo {user}",
            "{user}'s fucked off then",
            "there goes {user}, probably off to centrelink",
            "catch ya later {user}",
            "{user}'s gone to get ciggies, won't see them for 10 years",
            "fuckin seeya then {user}"
        ];

        this.responses = {
            thanks: [
                "no wukkas mate",
                "yeah nah all good",
                "she'll be right",
                "too easy mate",
                "no dramas"
            ],
            error: [
                "fuck me dead something's gone wrong",
                "nah that's fucked mate",
                "computer says no or some shit",
                "dunno what happened there",
                "she's carked it"
            ],
            busy: [
                "hang on I'm havin a dart",
                "gimme a sec I'm on the dunny",
                "fuck mate I'm cooked, try again",
                "I'm flat out like a lizard drinkin",
                "can't right now, Shazza's givin me grief"
            ],
            confused: [
                "the fuck you on about?",
                "yeah nah dunno what you mean",
                "you havin a laugh mate?",
                "speak fuckin english",
                "must be the drugs talkin"
            ]
        };
    }

    getGreeting(username) {
        const greeting = this.greetings[Math.floor(Math.random() * this.greetings.length)];
        return greeting.replace('{user}', username);
    }

    getFarewell(username) {
        const farewell = this.farewells[Math.floor(Math.random() * this.farewells.length)];
        return farewell.replace('{user}', username);
    }

    getResponse(type) {
        const responses = this.responses[type] || this.responses.confused;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    shouldGreet(lastGreetTime) {
        const twelveHours = 12 * 60 * 60 * 1000;
        return !lastGreetTime || (Date.now() - lastGreetTime) > twelveHours;
    }

    processMessage(message) {
        // Don't process command outputs that list commands
        if (message.includes('commands:') || message.includes('use !help')) {
            return message;
        }
        
        // Add Dazza flavor to certain responses
        const lowerMsg = message.toLowerCase();
        
        // Only add flavor to actual weather responses, not just mentions of the word
        if (lowerMsg.includes('weather') && (lowerMsg.includes('°') || lowerMsg.includes('degrees') || lowerMsg.includes('forecast'))) {
            return message + " but I'm inside rippin cones so who gives a fuck";
        }
        
        // Only add to actual time responses
        if (lowerMsg.includes('time') && (lowerMsg.includes(':') || lowerMsg.includes('am') || lowerMsg.includes('pm'))) {
            return message + " or beer o'clock, same diff";
        }
        
        return message;
    }

    getRandomExclamation() {
        const exclamations = [
            "fuckin oath",
            "bloody hell",
            "fuck me dead",
            "strewth",
            "crikey",
            "jesus christ",
            "fuck me sideways",
            "stone the crows"
        ];
        return exclamations[Math.floor(Math.random() * exclamations.length)];
    }
}