import BaseModule from '../../core/BaseModule.js';
import CharacterService from './services/CharacterService.js';

/**
 * Character Personality Module
 * Handles Dazza's personality traits, mention detection, and response generation
 * Extracted from bot.js and character.js for modular architecture
 */
class CharacterPersonalityModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'character-personality';
        this.dependencies = [];
        this.optionalDependencies = [];
    }

    async init() {
        await super.init();
        
        // Create CharacterService
        this.characterService = new CharacterService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Character Personality module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the character service
        await this.characterService.initialize();
        
        // Subscribe to chat messages for mention detection
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        
        // Register service (using 'personality' name for legacy compatibility)
        this.eventBus.emit('service:register', { 
            name: 'personality', 
            service: this.characterService 
        });
        
        this.logger.info('Character Personality module started');
    }

    /**
     * Handle chat messages for mention detection
     * @param {Object} data - Chat message data { room, username, message, time, meta }
     */
    async handleChatMessage(data) {
        try {
            this.logger.debug('[CHARACTER-PERSONALITY] Received chat message', {
                username: data?.username,
                message: data?.message?.substring(0, 50),
                hasData: !!data,
                dataKeys: data ? Object.keys(data) : []
            });
            
            if (!data || !data.username || !data.message) {
                this.logger.warn('[CHARACTER-PERSONALITY] Invalid chat message data', { data });
                return;
            }
            
            // Forward to character service for mention processing
            await this.characterService.handleMentionCheck(data);
            
        } catch (error) {
            this.logger.error('[CHARACTER-PERSONALITY] Error processing chat message', {
                error: error.message,
                stack: error.stack,
                username: data?.username,
                message: data?.message?.substring(0, 50)
            });
        }
    }

    async stop() {
        this.logger.info('Character Personality module stopping');
        
        if (this.characterService) {
            // Perform any cleanup needed
            this.characterService.ready = false;
        }
        
        await super.stop();
    }

    getStatus() {
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.characterService?.ready || false,
            services: {
                character: !!this.characterService
            }
        };
    }
}

export default CharacterPersonalityModule;