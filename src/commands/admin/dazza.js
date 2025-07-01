import { Command } from '../base.js';

// Helper function to send PMs with room context
function sendPM(bot, recipient, text, roomId) {
    if (roomId) {
        bot.sendPrivateMessage(recipient, text, roomId);
    } else {
        bot.sendPrivateMessage(recipient, text);
    }
}

export default new Command({
    name: 'dazza',
    aliases: ['dazzamoney', 'dazzabalance'],
    description: "Check how much money Dazza's made from his criminal enterprises",
    usage: '!dazza',
    examples: [
        '!dazza - See how rich Dazza is'
    ],
    category: 'economy',
    users: ['hildolfr'],
    cooldown: 5000,
    pmAccepted: true,

    async handler(bot, message, args) {
        try {
            // Check if HeistManager exists
            if (!bot.heistManager) {
                sendPM(bot, message.username, 'economy system not ready yet mate', message.roomId);
                return { success: false };
            }

            // Get Dazza's balance
            const dazzaBalance = await bot.heistManager.getUserBalance('dazza');
            
            const responses = [
                `dazza's got $${dazzaBalance.balance} hidden under his mattress (${dazzaBalance.trust} trust)`,
                `old mate dazza has $${dazzaBalance.balance} saved up, trust: ${dazzaBalance.trust}`,
                `dazza's beer fund: $${dazzaBalance.balance} - ${dazzaBalance.trustLevel.title}`,
                `our boy dazza's sitting on $${dazzaBalance.balance} (${dazzaBalance.trust} trust)`,
                `dazza's stash: $${dazzaBalance.balance} - mostly in coins`
            ];

            // Add special responses for different wealth levels
            if (dazzaBalance.balance > 10000) {
                responses.push(`fuckin hell, $${dazzaBalance.balance}?! dazza could pay rent for once`);
                responses.push(`$${dazzaBalance.balance}! that's like... a thousand slabs of VB`);
                responses.push(`dazza's got $${dazzaBalance.balance}? shazza's gonna want half`);
            } else if (dazzaBalance.balance < 100) {
                responses.push(`only $${dazzaBalance.balance}? classic dazza, broke as usual`);
                responses.push(`$${dazzaBalance.balance}... that's not even a carton`);
                responses.push(`dazza's down to $${dazzaBalance.balance}, must've hit the pokies again`);
            }

            sendPM(bot, message.username, responses[Math.floor(Math.random() * responses.length)], message.roomId);

            return { success: true };
        } catch (error) {
            bot.logger.error('Dazza balance command error:', error);
            sendPM(bot, message.username, 'failed to check dazza\'s stash', message.roomId);
            return { success: false };
        }
    }
});