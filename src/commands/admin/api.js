import { Command } from '../base.js';

export default new Command({
    name: 'api',
    aliases: [],
    description: 'Display API server status',
    usage: '!api',
    category: 'admin',
    adminOnly: true,
    cooldown: 3000,
    
    async handler(bot, message, args) {
        // Check if user is hildolfr
        if (message.username.toLowerCase() !== 'hildolfr') {
            bot.sendMessage(message.roomId, `Oi -${message.username}, ya not authorized for that one mate`);
            return { success: false };
        }
        
        if (!bot.apiServer) {
            bot.sendMessage(message.roomId, 'API server not initialized mate');
            return { success: true };
        }
        
        try {
            // Get API status
            const port = bot.apiServer.port;
            const endpoints = bot.apiServer.endpoints.size;
            const wsClients = bot.apiServer.io?.engine?.clientsCount || 0;
            const uptime = bot.apiServer.server?.listening ? Math.floor((Date.now() - bot.startTime) / 1000) : 0;
            
            // Get database stats for active users
            const activeUsers = await bot.db.get(
                'SELECT COUNT(DISTINCT username) as count FROM messages WHERE timestamp > ?',
                [Date.now() - 3600000] // Last hour
            );
            
            // Format uptime
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            
            // Create status message
            const status = bot.apiServer.server?.listening ? '🟢 Online' : '🔴 Offline';
            
            bot.sendMessage(message.roomId, `API ${status} | Port: ${port} | Endpoints: ${endpoints} | WS Clients: ${wsClients} | Uptime: ${uptimeStr} | Active Users: ${activeUsers.count}`);
            
        } catch (error) {
            bot.logger.error('Error getting API status:', error);
            bot.sendMessage(message.roomId, 'Failed to get API status mate');
        }
        
        return { success: true };
    }
});