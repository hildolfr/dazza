import { Command } from '../base.js';

export default new Command({
    name: 'forceheist',
    aliases: ['triggerheist', 'testheist'],
    description: 'Force trigger a heist (testing only)',
    usage: '!forceheist',
    examples: [
        '!forceheist - Force Dazza to start a heist immediately'
    ],
    category: 'economy',
    users: ['hildolfr'],
    cooldown: 1000,

    async handler(bot, message, args) {
        try {
            // Check if HeistManager exists
            if (!bot.heistManager) {
                bot.sendMessage('heist system not initialized yet');
                return { success: false };
            }

            // Check current state
            const currentState = bot.heistManager.currentState;
            const states = bot.heistManager.states;
            
            // Allow forcing from IDLE or COOLDOWN states
            if (currentState !== states.IDLE && currentState !== states.COOLDOWN) {
                bot.sendMessage(`can't force heist - already in ${currentState} state`);
                return { success: false };
            }
            
            // If in cooldown, force it to IDLE first
            if (currentState === states.COOLDOWN) {
                // Clear the cooldown timer
                if (bot.heistManager.stateTimer) {
                    clearTimeout(bot.heistManager.stateTimer);
                    bot.heistManager.stateTimer = null;
                }
                await bot.heistManager.setState(states.IDLE);
                bot.logger.info('Forced heist out of cooldown state');
            }

            // Clear any existing timers
            if (bot.heistManager.nextHeistTimer) {
                clearTimeout(bot.heistManager.nextHeistTimer);
                bot.heistManager.nextHeistTimer = null;
            }

            // Force start the heist
            bot.logger.info(`Heist force-triggered by ${message.username}`);
            await bot.heistManager.startHeist();

            // The heist manager will handle scheduling the next one after completion
            bot.sendMessage('forced heist trigger - testing mode activated');

            return { success: true };
        } catch (error) {
            bot.logger.error('Force heist command error:', error);
            bot.sendMessage('failed to force trigger heist: ' + error.message);
            return { success: false };
        }
    }
});