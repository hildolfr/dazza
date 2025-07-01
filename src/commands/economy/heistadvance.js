import { Command } from '../base.js';

export default new Command({
    name: 'heistadvance',
    aliases: ['heistskip', 'heistnext'],
    description: 'Force advance the current heist phase (developer only)',
    usage: '!heistadvance',
    examples: [
        '!heistadvance - Skip to the next heist phase'
    ],
    category: 'economy',
    users: ['hildolfr'],
    cooldown: 1000,
    pmAccepted: true,
    pmResponses: true,

    async handler(bot, message, args) {
        // Reject if not from PM
        if (!message.isPM) {
            return { success: false };
        }
        try {
            // Check if HeistManager exists
            if (!bot.heistManager) {
                bot.sendMessage(message.roomId, 'heist system not initialized yet');
                return { success: false };
            }

            const hm = bot.heistManager;
            const currentState = hm.currentState;

            // Clear any existing state timer
            if (hm.stateTimer) {
                clearTimeout(hm.stateTimer);
                hm.stateTimer = null;
            }

            switch (currentState) {
                case hm.states.IDLE:
                    bot.sendMessage(message.roomId, 'heist is idle - use !forceheist to start one');
                    return { success: false };

                case hm.states.VOTING:
                    bot.sendMessage(message.roomId, 'advancing: ending voting phase and executing heist');
                    bot.logger.info(`Heist voting phase force-advanced by ${message.username}`);
                    
                    // Make sure we're still in voting state before executing
                    if (hm.currentState === hm.states.VOTING) {
                        await hm.executeHeist();
                    }
                    break;

                case hm.states.IN_PROGRESS:
                    bot.sendMessage(message.roomId, 'advancing: completing heist immediately');
                    bot.logger.info(`Heist in-progress phase force-advanced by ${message.username}`);
                    
                    // Get the current crime
                    const crimeId = await hm.getConfig('current_crime_id');
                    if (crimeId) {
                        // Import contentLoader to get crime data
                        const { contentLoader } = await import('../../modules/heist/contentLoader.js');
                        const crimes = contentLoader.getCrimes();
                        const crime = crimes.find(c => c.id === crimeId);
                        if (crime && hm.currentState === hm.states.IN_PROGRESS) {
                            await hm.completeHeist(crime);
                        } else {
                            bot.sendMessage(message.roomId, 'warning: could not find crime data');
                            return { success: false };
                        }
                    } else {
                        bot.sendMessage(message.roomId, 'error: no crime in progress');
                        return { success: false };
                    }
                    break;

                case hm.states.COOLDOWN:
                    bot.sendMessage(message.roomId, 'advancing: ending cooldown and scheduling next heist');
                    bot.logger.info(`Heist cooldown phase force-advanced by ${message.username}`);
                    
                    // End cooldown and go to idle
                    await hm.setState(hm.states.IDLE);
                    hm.scheduleRandomHeist();
                    break;

                case hm.states.ANNOUNCING:
                    bot.sendMessage(message.roomId, 'heist is currently announcing - wait a moment');
                    return { success: false };

                case hm.states.DISTRIBUTING:
                    bot.sendMessage(message.roomId, 'heist is currently distributing rewards - wait a moment');
                    return { success: false };

                default:
                    bot.sendMessage(message.roomId, `unknown heist state: ${currentState}`);
                    return { success: false };
            }

            return { success: true };
        } catch (error) {
            bot.logger.error('Heist advance command error:', error);
            bot.sendMessage(message.roomId, 'failed to advance heist: ' + error.message);
            return { success: false };
        }
    }
});