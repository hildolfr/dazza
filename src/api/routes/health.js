import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export function createHealthRoutes(apiServer) {
    const router = Router();
    const startTime = Date.now();
    
    // GET /api/v1/health - Basic health check
    router.get('/health', asyncHandler(async (req, res) => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        // Get bot status
        const botConnected = apiServer.bot.connection?.connected || false;
        const databaseConnected = apiServer.bot.db ? true : false;
        
        // Get WebSocket client count
        const wsClients = apiServer.io.engine.clientsCount || 0;
        
        res.json({
            success: true,
            data: {
                status: 'ok',
                uptime,
                version: '1.0.0',
                endpoints: apiServer.endpoints.size,
                connections: {
                    bot: botConnected,
                    database: databaseConnected,
                    websocket: wsClients
                },
                timestamp: new Date().toISOString()
            }
        });
    }));
    
    // GET /api/v1/health/detailed - Detailed health information
    router.get('/health/detailed', asyncHandler(async (req, res) => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        // Memory usage
        const memUsage = process.memoryUsage();
        const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
        
        // Get database stats
        let dbStats = null;
        if (apiServer.bot.db) {
            try {
                const result = await apiServer.bot.db.get(`
                    SELECT 
                        (SELECT COUNT(*) FROM messages) as messageCount,
                        (SELECT COUNT(*) FROM user_stats) as userCount,
                        (SELECT COUNT(*) FROM user_images WHERE is_active = 1) as activeImages
                `);
                dbStats = result;
            } catch (err) {
                dbStats = { error: err.message };
            }
        }
        
        res.json({
            success: true,
            data: {
                status: 'ok',
                uptime,
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                memory: {
                    rss: formatBytes(memUsage.rss),
                    heapTotal: formatBytes(memUsage.heapTotal),
                    heapUsed: formatBytes(memUsage.heapUsed),
                    external: formatBytes(memUsage.external)
                },
                endpoints: Array.from(apiServer.endpoints).sort(),
                database: dbStats,
                bot: {
                    connected: apiServer.bot.connection?.connected || false,
                    channel: apiServer.bot.connection?.channel || null,
                    username: apiServer.bot.connection?.username || null
                },
                websocket: {
                    clients: apiServer.io.engine.clientsCount || 0
                },
                timestamp: new Date().toISOString()
            }
        });
    }));
    
    // GET /api/v1/health/endpoints - List all available endpoints
    router.get('/health/endpoints', (req, res) => {
        const endpoints = Array.from(apiServer.endpoints).sort().map(endpoint => {
            const [method, path] = endpoint.split(' ');
            return { method, path };
        });
        
        res.json({
            success: true,
            data: {
                count: endpoints.length,
                endpoints
            }
        });
    });
    
    // Register endpoints
    apiServer.registerEndpoint('GET', '/api/v1/health');
    apiServer.registerEndpoint('GET', '/api/v1/health/detailed');
    apiServer.registerEndpoint('GET', '/api/v1/health/endpoints');
    
    return router;
}