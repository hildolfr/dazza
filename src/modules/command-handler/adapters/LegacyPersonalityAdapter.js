/**
 * Legacy Personality Adapter - Provides backward compatibility for personality responses
 * This adapter wraps personality services or provides fallback responses
 */
class LegacyPersonalityAdapter {
    constructor(services) {
        this.services = services;
        this.personalityService = services.get('personality');
        this.logger = null;
    }
    
    setLogger(logger) {
        this.logger = logger;
    }
    
    getResponse(type, context = {}) {
        if (this.personalityService) {
            return this.personalityService.getResponse(type, context);
        }
        
        // Fallback responses matching Dazza's personality
        const fallbackResponses = {
            error: [
                'fuck me dead that went tits up',
                'bloody hell something carked it',
                'strewth that fucked up somehow',
                'shit a brick that went wrong',
                'bugger me that broke'
            ],
            success: [
                'yeah nah yeah that worked',
                'beauty mate, sorted',
                'fuckin legend, done',
                'sweet as bro',
                'top stuff mate'
            ],
            cooldown: [
                'hold ya horses there mate',
                'slow down turbo',
                'patience grasshopper',
                'chill ya beans',
                'ease up there champion'
            ],
            permission_denied: [
                'nice try dickhead',
                'yeah nah not for you mate',
                'dream on sunshine',
                'keep dreaming champion',
                'not happening buddy'
            ],
            not_found: [
                'dunno what ya talkin bout mate',
                'never heard of that shit',
                'no idea what that is',
                'beats me mate',
                'fuck knows what that is'
            ]
        };
        
        const responses = fallbackResponses[type] || fallbackResponses.error;
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    getRandomResponse(responses) {
        if (this.personalityService) {
            return this.personalityService.getRandomResponse(responses);
        }
        
        if (Array.isArray(responses)) {
            return responses[Math.floor(Math.random() * responses.length)];
        }
        
        return responses;
    }
    
    isReady() {
        return true; // Always ready with fallback responses
    }
}

export default LegacyPersonalityAdapter;