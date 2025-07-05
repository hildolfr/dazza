import { OllamaService } from '../../../services/ollama.js';

/**
 * Character Service
 * Combines Dazza personality traits, mention detection, response generation, and Ollama integration
 * Extracted from bot.js (lines 1806-1844) and character.js for modular architecture
 */
class CharacterService {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        
        // Personality configuration
        this.enablePersonality = config.enablePersonality !== false;
        this.enableMentionDetection = config.enableMentionDetection !== false;
        this.enableMessageProcessing = config.enableMessageProcessing !== false;
        this.greetingCooldown = config.greetingCooldown || 43200000; // 12 hours
        this.testModePattern = new RegExp(config.testModePattern || '!!$');
        
        // Initialize personality data
        this.initializePersonalityData();
        
        // Initialize Ollama service
        this.ollamaService = new OllamaService(config);
        
        this.ready = false;
    }
    
    async initialize() {
        this.eventBus = this.services.get('eventBus');
        
        // Subscribe to mention detection events
        if (this.eventBus) {
            this.eventBus.on('chat:message', this.handleMentionCheck.bind(this));
        }
        
        this.ready = true;
        this.logger.info('CharacterService initialized with Ollama integration');
    }
    
    /**
     * Initialize Dazza's personality data
     * From character.js - converted to CommonJS format
     */
    initializePersonalityData() {
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
                "she's carked it",
                "well that's fucked innit",
                "computer says no... and so do I",
                "error 420: too cooked to compute",
                "fucked it harder than a bunnings snag on concrete",
                "that went tits up faster than me last centrelink claim",
                "error: brain cells not found (smoked em all)",
                "shit's fucked harder than me liver",
                "dropped the ball like me dad dropped me",
                "failed harder than me year 10 exams",
                "bout as useful as tits on a bull",
                "gone wrong like a fart in church",
                "fucked it up worse than shazza's cooking",
                "error: too many bongs, can't process",
                "broke faster than me after payday",
                "failed like me pull-out game"
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
        
        this.exclamations = [
            "fuckin oath",
            "bloody hell",
            "fuck me dead",
            "strewth",
            "crikey",
            "jesus christ",
            "fuck me sideways",
            "stone the crows"
        ];
    }
    
    /**
     * Check if a message contains a mention of Dazza
     * Extracted from bot.js lines 1806-1834
     * @param {string} message - The message to check
     * @returns {boolean} True if the message mentions Dazza
     */
    hasMention(message) {
        if (!this.enableMentionDetection || !message || typeof message !== 'string') {
            return false;
        }
        
        const lowerMsg = message.toLowerCase();
        
        // Patterns that indicate talking ABOUT Dazza, not TO him
        const aboutDazzaPatterns = [
            /\b(dazza|daz)'s\b/i,                          // Possessive (dazza's)
            /\b(dazza|daz)\s+(took|nicked|already|scrapes|cut|share|profit)/i, // Heist narratives
            /\b(after|minus|with)\s+(dazza|daz)/i,         // Prepositional phrases
        ];
        
        // If it's talking ABOUT Dazza, not a mention
        if (aboutDazzaPatterns.some(pattern => pattern.test(lowerMsg))) {
            return false;
        }
        
        // Patterns for actual mentions/addresses to Dazza
        const mentionPatterns = [
            /^(hey |hi |yo |oi |g'day |sup )?(dazza|daz)([,!?]|\s|$)/i,  // Greeting at start
            /[,.!?;]\s*(hey |hi |yo |oi )?(dazza|daz)([,!?]|\s|$)/i,     // After punctuation
            /\b(dazza|daz)[,!?]?\s+(you|ya|mate|cunt|there)/i,           // Direct address
            /@(dazza|daz)\b/i,                                            // @ mention style
            /\b(dazza|daz)\s*\?/i,                                        // Question to Dazza
            /\b(dazza|daz)\s*!+$/i,                                       // Exclamation at end
            /\b(dazza|daz)$/i,                                            // Dazza as last word
        ];
        
        // Check if any pattern matches
        const isMention = mentionPatterns.some(pattern => pattern.test(lowerMsg));
        
        if (isMention) {
            this.logger.debug('Mention detected', {
                message: message.substring(0, 50),
                patterns: mentionPatterns.map(p => p.toString()).filter(p => new RegExp(p.slice(1, -2), 'i').test(lowerMsg))
            });
            
            if (this.eventBus) {
                this.eventBus.emit('character:mention:detected', {
                    message: message,
                    timestamp: Date.now()
                });
            }
        }
        
        return isMention;
    }
    
    /**
     * Check if this is a test override (dazza with !!)
     * Extracted from bot.js lines 1841-1844
     * @param {string} message - The message to check
     * @returns {boolean} True if it's a test override
     */
    isTestOverride(message) {
        if (!message || typeof message !== 'string') {
            return false;
        }
        
        // Must mention dazza in a way that would trigger hasMention() AND end with !!
        return this.hasMention(message) && this.testModePattern.test(message);
    }
    
    /**
     * Get a random greeting for a user
     * From character.js
     * @param {string} username - Username to greet
     * @returns {string} Personalized greeting
     */
    getGreeting(username) {
        if (!this.enablePersonality || !username) {
            return `Hello ${username}`;
        }
        
        const greeting = this.greetings[Math.floor(Math.random() * this.greetings.length)];
        const result = greeting.replace('{user}', username);
        
        this.logger.debug('Generated greeting', { username, greeting: result });
        
        if (this.eventBus) {
            this.eventBus.emit('character:greeting:generated', {
                username: username,
                greeting: result,
                timestamp: Date.now()
            });
        }
        
        return result;
    }
    
    /**
     * Get a random farewell for a user
     * From character.js
     * @param {string} username - Username to bid farewell
     * @returns {string} Personalized farewell
     */
    getFarewell(username) {
        if (!this.enablePersonality || !username) {
            return `Goodbye ${username}`;
        }
        
        const farewell = this.farewells[Math.floor(Math.random() * this.farewells.length)];
        const result = farewell.replace('{user}', username);
        
        this.logger.debug('Generated farewell', { username, farewell: result });
        
        if (this.eventBus) {
            this.eventBus.emit('character:farewell:generated', {
                username: username,
                farewell: result,
                timestamp: Date.now()
            });
        }
        
        return result;
    }
    
    /**
     * Get a response of a specific type
     * From character.js
     * @param {string} type - Response type (thanks, error, busy, confused)
     * @returns {string} Random response of the specified type
     */
    getResponse(type) {
        if (!this.enablePersonality) {
            return 'OK';
        }
        
        const responses = this.responses[type] || this.responses.confused;
        const result = responses[Math.floor(Math.random() * responses.length)];
        
        this.logger.debug('Generated response', { type, response: result });
        
        if (this.eventBus) {
            this.eventBus.emit('character:response:generated', {
                type: type,
                response: result,
                timestamp: Date.now()
            });
        }
        
        return result;
    }
    
    /**
     * Get a random exclamation
     * From character.js
     * @returns {string} Random Australian exclamation
     */
    getRandomExclamation() {
        if (!this.enablePersonality) {
            return 'OK';
        }
        
        return this.exclamations[Math.floor(Math.random() * this.exclamations.length)];
    }
    
    /**
     * Check if a user should be greeted (based on time since last greeting)
     * From character.js
     * @param {number} lastGreetTime - Timestamp of last greeting
     * @returns {boolean} True if user should be greeted
     */
    shouldGreet(lastGreetTime) {
        return !lastGreetTime || (Date.now() - lastGreetTime) > this.greetingCooldown;
    }
    
    /**
     * Process a message and add Dazza personality flavor
     * From character.js lines 90-110
     * @param {string} message - The message to process
     * @returns {string} Message with personality added
     */
    processMessage(message) {
        if (!this.enableMessageProcessing || !message || typeof message !== 'string') {
            return message;
        }
        
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
    
    /**
     * Get character status and configuration
     * @returns {Object} Character service status
     */
    getCharacterStatus() {
        return {
            ready: this.ready,
            personality: this.enablePersonality,
            mentionDetection: this.enableMentionDetection,
            messageProcessing: this.enableMessageProcessing,
            greetingCooldown: this.greetingCooldown,
            greetingCount: this.greetings.length,
            farewellCount: this.farewells.length,
            responseTypes: Object.keys(this.responses),
            exclamationCount: this.exclamations.length
        };
    }
    
    /**
     * Update personality configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        if (newConfig.enablePersonality !== undefined) {
            this.enablePersonality = newConfig.enablePersonality;
        }
        if (newConfig.enableMentionDetection !== undefined) {
            this.enableMentionDetection = newConfig.enableMentionDetection;
        }
        if (newConfig.enableMessageProcessing !== undefined) {
            this.enableMessageProcessing = newConfig.enableMessageProcessing;
        }
        if (newConfig.greetingCooldown !== undefined) {
            this.greetingCooldown = newConfig.greetingCooldown;
        }
        
        this.logger.info('Character configuration updated', newConfig);
    }
    
    /**
     * Add custom greetings/farewells/responses (for extensibility)
     * @param {string} type - Type to add to (greetings, farewells, responses)
     * @param {string|Array} items - Items to add
     * @param {string} responseType - For responses, the specific type (thanks, error, etc.)
     */
    addCustomContent(type, items, responseType = null) {
        const itemArray = Array.isArray(items) ? items : [items];
        
        switch (type) {
            case 'greetings':
                this.greetings.push(...itemArray);
                break;
            case 'farewells':
                this.farewells.push(...itemArray);
                break;
            case 'responses':
                if (responseType && this.responses[responseType]) {
                    this.responses[responseType].push(...itemArray);
                }
                break;
            case 'exclamations':
                this.exclamations.push(...itemArray);
                break;
        }
        
        this.logger.debug('Added custom content', { type, count: itemArray.length, responseType });
    }
    
    /**
     * Handle mention detection and generate Ollama responses
     * @param {Object} data - Message data from chat:message event
     */
    async handleMentionCheck(data) {
        try {
            if (!data || !data.message || !data.username) {
                return;
            }
            
            // Check if this message mentions Dazza
            if (this.hasMention(data.message)) {
                this.logger.info('Dazza mention detected, generating Ollama response', {
                    username: data.username,
                    message: data.message.substring(0, 50)
                });
                
                await this.generateOllamaResponse(data);
            }
        } catch (error) {
            this.logger.error('Error in mention handling:', error);
        }
    }
    
    /**
     * Generate and send Ollama response for Dazza mentions
     * @param {Object} messageData - Message data containing username, message, etc.
     */
    async generateOllamaResponse(messageData) {
        try {
            // Check if Ollama is available
            if (!await this.ollamaService.isAvailable()) {
                this.logger.warn('Ollama service not available, skipping response generation');
                return;
            }
            
            const response = await this.ollamaService.generateResponse(messageData.message, {
                username: messageData.username,
                context: 'chat_mention'
            });
            
            if (response) {
                // Get connection service to send the response
                const connectionService = this.services.get('connection');
                if (connectionService && connectionService.sendMessage) {
                    const roomId = messageData.room || 'fatpizza'; // Use provided room or default
                    await connectionService.sendMessage(roomId, response);
                    this.logger.info('Ollama response sent', {
                        username: messageData.username,
                        room: roomId,
                        responseLength: response.length
                    });
                } else {
                    this.logger.warn('Connection service not available, cannot send Ollama response');
                }
            }
        } catch (error) {
            this.logger.error('Error generating Ollama response:', error);
            
            // Send a fallback response using personality data
            const fallbackResponse = this.getResponse('confused');
            const connectionService = this.services.get('connection');
            if (connectionService && connectionService.sendMessage) {
                const roomId = messageData.room || 'fatpizza'; // Use provided room or default
                await connectionService.sendMessage(roomId, fallbackResponse);
                this.logger.info('Sent fallback response due to Ollama error', { room: roomId });
            }
        }
    }
}

export default CharacterService;