import { Router } from 'express';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

export function createChatRoutes(apiServer) {
    const router = Router();
    
    // GET /api/v1/chat/recent - Get recent chat messages
    router.get('/recent', asyncHandler(async (req, res) => {
        const { limit = 10 } = req.query;
        const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
        
        // Get recent messages excluding bot and server messages
        const recentMessages = await apiServer.bot.db.all(`
            SELECT username, message, timestamp
            FROM messages
            WHERE LOWER(username) NOT IN (?, '[server]')
            AND username NOT LIKE '[%]'
            ORDER BY timestamp DESC
            LIMIT ?
        `, [apiServer.bot.username?.toLowerCase() || 'dazza', limitNum]);
        
        // Format messages for display
        const formattedMessages = recentMessages.map(msg => ({
            username: msg.username,
            message: msg.message,
            timestamp: msg.timestamp,
            timeAgo: getTimeAgo(msg.timestamp)
        })).reverse(); // Reverse to show oldest first
        
        res.json({
            success: true,
            data: {
                messages: formattedMessages,
                channel: apiServer.bot.connection?.channel || 'fatpizza'
            }
        });
    }));
    
    // GET /api/v1/chat/stream - Server-sent events for real-time chat
    router.get('/stream', (req, res) => {
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send initial connection message
        res.write('event: connected\ndata: {"connected": true}\n\n');
        
        // Create message handler
        const messageHandler = (data) => {
            if (data.username && data.message) {
                const payload = {
                    username: data.username,
                    message: data.message,
                    timestamp: data.timestamp || Date.now(),
                    timeAgo: getTimeAgo(data.timestamp || Date.now())
                };
                res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
            }
        };
        
        // Subscribe to chat messages via WebSocket
        if (apiServer.bot.wsServer) {
            // Hook into existing WebSocket broadcast system
            const originalBroadcast = apiServer.bot.wsServer.broadcast;
            apiServer.bot.wsServer.broadcast = function(type, data) {
                originalBroadcast.call(this, type, data);
                if (type === 'chat_message') {
                    messageHandler(data);
                }
            };
        }
        
        // Clean up on client disconnect
        req.on('close', () => {
            // Restore original broadcast if needed
            if (apiServer.bot.wsServer && originalBroadcast) {
                apiServer.bot.wsServer.broadcast = originalBroadcast;
            }
        });
        
        // Keep connection alive
        const keepAlive = setInterval(() => {
            res.write('event: ping\ndata: {"ping": true}\n\n');
        }, 30000);
        
        req.on('close', () => {
            clearInterval(keepAlive);
        });
    });
    
    // Helper function to get relative time
    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return `${Math.floor(seconds / 604800)}w ago`;
    }
    
    // Register endpoints
    apiServer.registerEndpoint('GET', '/api/v1/chat/recent');
    apiServer.registerEndpoint('GET', '/api/v1/chat/stream');
    
    return router;
}