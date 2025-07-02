import { Command } from '../base.js';

export default new Command({
    name: 'heiststatus',
    aliases: ['heistinfo', 'heiststate'],
    description: 'View current heist state and timers (developer only)',
    usage: '!heiststatus',
    examples: [
        '!heiststatus - Shows current heist state, votes, and timers'
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
            const statusLines = [];

            // Basic state info
            statusLines.push(`[HEIST STATUS] State: ${currentState}`);

            // State-specific information
            switch (currentState) {
                case hm.states.IDLE:
                    // Show next heist time
                    const nextHeistTime = await hm.getConfig('next_heist_time');
                    if (nextHeistTime) {
                        const timeUntil = parseInt(nextHeistTime) - Date.now();
                        if (timeUntil > 0) {
                            const hours = Math.floor(timeUntil / (60 * 60 * 1000));
                            const minutes = Math.floor((timeUntil % (60 * 60 * 1000)) / (60 * 1000));
                            statusLines.push(`Next heist in: ${hours}h ${minutes}m`);
                        } else {
                            statusLines.push('Next heist: overdue (waiting for activity)');
                        }
                    } else {
                        statusLines.push('Next heist: not scheduled');
                    }
                    
                    // Show activity stats
                    statusLines.push(`Active users: ${hm.activeUsers.size}, Messages: ${hm.messageCount}`);
                    break;

                case hm.states.VOTING:
                    // Show voting info
                    const votingEndTime = await hm.getConfig('state_timer_end');
                    if (votingEndTime) {
                        const timeRemaining = parseInt(votingEndTime) - Date.now();
                        if (timeRemaining > 0) {
                            const seconds = Math.floor(timeRemaining / 1000);
                            statusLines.push(`Voting ends in: ${seconds}s`);
                        } else {
                            statusLines.push('Voting: timer expired (executing soon)');
                        }
                    }
                    
                    // Show current crimes
                    if (hm.currentHeistCrimes.length > 0) {
                        const crimeNames = hm.currentHeistCrimes.map(c => c.name).join(' vs ');
                        statusLines.push(`Crimes: ${crimeNames}`);
                    }
                    
                    // Show vote counts
                    if (hm.votes.size > 0) {
                        const voteCounts = new Map();
                        for (const [user, crimeId] of hm.votes) {
                            voteCounts.set(crimeId, (voteCounts.get(crimeId) || 0) + 1);
                        }
                        
                        const voteInfo = [];
                        for (const crime of hm.currentHeistCrimes) {
                            const count = voteCounts.get(crime.id) || 0;
                            voteInfo.push(`${crime.name}: ${count}`);
                        }
                        statusLines.push(`Votes: ${voteInfo.join(', ')} (Total: ${hm.votes.size})`);
                    } else {
                        statusLines.push('Votes: none yet');
                    }
                    break;

                case hm.states.IN_PROGRESS:
                    // Show heist progress
                    const crimeEndTime = await hm.getConfig('state_timer_end');
                    const crimeId = await hm.getConfig('current_crime_id');
                    
                    if (crimeId) {
                        // Import contentLoader to get crime data
                        const { contentLoader } = await import('../../modules/heist/contentLoader.js');
                        const crimes = contentLoader.getCrimes();
                        const crime = crimes.find(c => c.id === crimeId);
                        if (crime) {
                            statusLines.push(`Current crime: ${crime.name}`);
                        }
                    }
                    
                    if (crimeEndTime) {
                        const timeRemaining = parseInt(crimeEndTime) - Date.now();
                        if (timeRemaining > 0) {
                            const minutes = Math.floor(timeRemaining / 60000);
                            const seconds = Math.floor((timeRemaining % 60000) / 1000);
                            statusLines.push(`Returns in: ${minutes}m ${seconds}s`);
                        } else {
                            statusLines.push('Crime: completed (processing results)');
                        }
                    }
                    
                    // Show participants
                    if (hm.votes.size > 0) {
                        statusLines.push(`Participants: ${hm.votes.size}`);
                    } else {
                        statusLines.push('Participants: dazza solo');
                    }
                    break;

                case hm.states.COOLDOWN:
                    // Show cooldown time
                    const cooldownEndTime = await hm.getConfig('state_timer_end');
                    if (cooldownEndTime) {
                        const timeRemaining = parseInt(cooldownEndTime) - Date.now();
                        if (timeRemaining > 0) {
                            const seconds = Math.floor(timeRemaining / 1000);
                            statusLines.push(`Cooldown ends in: ${seconds}s`);
                        } else {
                            statusLines.push('Cooldown: expired (going to idle)');
                        }
                    }
                    break;

                case hm.states.ANNOUNCING:
                    statusLines.push('Currently announcing heist...');
                    break;

                case hm.states.DISTRIBUTING:
                    statusLines.push('Currently distributing rewards...');
                    break;
            }

            // Show heist ID if active
            if (hm.currentHeistId) {
                statusLines.push(`Heist ID: ${hm.currentHeistId}`);
            }

            // Send all status lines
            bot.sendMessage(message.roomId, statusLines.join(' | '));

            return { success: true };
        } catch (error) {
            bot.logger.error('Heist status command error:', { error: error.message, stack: error.stack });
            bot.sendMessage(message.roomId, 'failed to get heist status: ' + error.message);
            return { success: false };
        }
    }
});