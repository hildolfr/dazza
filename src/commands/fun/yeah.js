import { Command } from '../base.js';

export default new Command({
    name: 'yeah',
    aliases: ['yea', 'yeahnah', 'nahyeah'],
    description: 'yeah nah yeah nah',
    usage: '!yeah [username]',
    category: 'fun',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        const responses = [
            'YEAH NAH YEAH',
            'NAH YEAH NAH MATE', 
            'YEAH NAH YEAH NAH YEAH',
            'NAH YEAH MATE, NAH YEAH',
            'YEAH NAH BUT YEAH BUT NAH',
            'NAH YEAH NAH YEAH NAH YEAH YEAH',
            'yeah... nah',
            'nah... yeah',
            'yeah nah for sure',
            'nah yeah definitely', 
            'yeah but nah',
            'nah but yeah',
            'yeah nah maybe',
            'nah yeah possibly',
            'fuckin... yeah?',
            'fuckin... nah?',
            'yeah nah get fucked',
            'nah yeah too right',
            'YEAH YEAH NAH YEAH',
            'NAH NAH YEAH NAH',
            'yeah nah yeah nah fuck knows',
            'nah yeah nah yeah whatever',
            'yeah *coughs* nah',
            'nah *rips cone* yeah',
            'yeah nah ask shazza',
            'nah yeah ask the missus'
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        
        // Check if targeting a user
        if (args.length > 0) {
            const targetUser = args[0];
            bot.sendMessage(message.roomId, `${targetUser}: ${response}`);
        } else {
            bot.sendMessage(message.roomId, response);
        }
        
        return { success: true };
    }
});