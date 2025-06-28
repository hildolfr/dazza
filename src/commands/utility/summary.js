import { Command } from '../base.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('SummaryCommand');

export default new Command({
    name: 'summary',
    description: 'Summarize chat history from the last X hours via PM',
    usage: '!summary <hours>',
    category: 'utility',
    cooldown: 30000, // 30 second cooldown
    pmAccepted: true, // Accept this command in PMs
    
    async handler(bot, message, args) {
        if (!args[0]) {
            bot.sendMessage(`-${message.username} usage: !summary <hours> (e.g., !summary 2)`);
            return { success: true };
        }
        
        const hours = parseFloat(args[0]);
        if (isNaN(hours) || hours <= 0 || hours > 24) {
            bot.sendMessage(`-${message.username} mate, gimme a number between 0 and 24 hours`);
            return { success: true };
        }
        
        // Check if Ollama is available
        if (!bot.ollama) {
            bot.sendMessage(`-${message.username} sorry mate, me brain's not workin right now`);
            return { success: false };
        }
        
        const isAvailable = await bot.ollama.isAvailable();
        if (!isAvailable) {
            bot.sendMessage(`-${message.username} cant think straight right now, try again later`);
            return { success: false };
        }
        
        try {
            // Acknowledge the request in public chat (with - to avoid mention)
            bot.sendMessage(`-${message.username} righto, checkin me notes from the last ${hours} hour${hours === 1 ? '' : 's'}... check ya PMs in a sec`);
            
            // Get messages from the database
            const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
            const messages = await bot.db.getMessagesSince(cutoffTime);
            
            // Filter out bot messages, server messages, and system messages
            const humanMessages = messages.filter(msg => {
                const username = msg.username.toLowerCase();
                // Filter out bot
                if (username === 'dazza' || username === bot.username.toLowerCase() || 
                    username === bot.config.bot.username.toLowerCase()) {
                    return false;
                }
                // Filter out system messages
                if (username === '[server]' || username.startsWith('[') || username === 'cytube' || 
                    username === 'system' || username === 'bot') {
                    return false;
                }
                // Filter out bot commands
                if (msg.message && msg.message.startsWith('!')) {
                    return false;
                }
                return true;
            });
            
            if (humanMessages.length === 0) {
                bot.sendPrivateMessage(message.username, `No chat messages found in the last ${hours} hour${hours === 1 ? '' : 's'}.`);
                return { success: true };
            }
            
            // Prepare chat log for summarization - include ALL messages for accuracy
            const messagesToSummarize = humanMessages;
            
            // Format messages with timestamps for context
            const chatLog = messagesToSummarize.map(msg => {
                const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                // Include full messages for accuracy
                return `[${time}] ${msg.username}: ${msg.message}`;
            }).join('\n');
            
            logger.debug(`Summarizing ${messagesToSummarize.length} human messages (from ${humanMessages.length} filtered, ${messages.length} total) in last ${hours} hours`);
            
            // Log sample of what we're sending
            if (messagesToSummarize.length > 0) {
                logger.debug('Sample messages being summarized:', {
                    first: chatLog.split('\n')[0],
                    last: chatLog.split('\n').slice(-1)[0],
                    totalChars: chatLog.length
                });
            }
            
            // Debug: log filtered usernames
            const filteredUsers = new Set();
            messages.forEach(msg => {
                if (!humanMessages.includes(msg)) {
                    filteredUsers.add(msg.username);
                }
            });
            if (filteredUsers.size > 0) {
                logger.debug(`Filtered out messages from: ${Array.from(filteredUsers).join(', ')}`);
            }
            
            // Generate summary using Ollama's dedicated summary method
            const summaryMessages = await bot.ollama.generateSummary(chatLog, hours);
            
            if (!summaryMessages || summaryMessages.length === 0) {
                bot.sendPrivateMessage(message.username, 'Failed to generate summary. Too cooked to think straight.');
                return { success: false };
            }
            
            // Send summary via PM - up to 2 messages
            for (let i = 0; i < summaryMessages.length && i < 2; i++) {
                setTimeout(() => {
                    bot.sendPrivateMessage(message.username, summaryMessages[i]);
                }, i * 1000); // 1 second delay between messages
            }
            
            return { success: true };
            
        } catch (error) {
            logger.error('Summary command error:', error);
            bot.sendMessage(`-${message.username} fuck, somethin went wrong with that`);
            return { success: false };
        }
    }
});