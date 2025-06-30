import { Router } from 'express';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

export function createStatsRoutes(apiServer) {
    const router = Router();
    
    // GET /api/v1/stats/users/:username - Get user statistics
    router.get('/users/:username', asyncHandler(async (req, res) => {
        const { username } = req.params;
        
        if (!username) {
            throw new ValidationError('Username is required', 'username');
        }
        
        const normalizedUsername = username.toLowerCase();
        
        // Get user stats
        const userStats = await apiServer.bot.db.get(
            'SELECT * FROM user_stats WHERE username = ?',
            [normalizedUsername]
        );
        
        if (!userStats) {
            throw new NotFoundError('User');
        }
        
        // Get additional stats
        const [bongCount, drinkCount, balance, criminalRecord, imageCount] = await Promise.all([
            apiServer.bot.db.get(
                'SELECT COUNT(*) as count FROM user_bongs WHERE username = ?',
                [normalizedUsername]
            ),
            apiServer.bot.db.get(
                'SELECT COUNT(*) as count FROM user_drinks WHERE username = ?',
                [normalizedUsername]
            ),
            apiServer.bot.db.get(
                'SELECT balance FROM economy_users WHERE username = ?',
                [normalizedUsername]
            ),
            apiServer.bot.db.get(
                'SELECT record FROM criminal_records WHERE username = ?',
                [normalizedUsername]
            ),
            apiServer.bot.db.get(
                'SELECT COUNT(*) as count FROM user_images WHERE username = ? AND is_active = 1',
                [normalizedUsername]
            )
        ]);
        
        res.json({
            success: true,
            data: {
                username: normalizedUsername,
                firstSeen: new Date(userStats.first_seen).toISOString(),
                lastSeen: new Date(userStats.last_seen).toISOString(),
                messageCount: userStats.message_count,
                bongCount: bongCount?.count || 0,
                drinkCount: drinkCount?.count || 0,
                balance: balance?.balance || 0,
                criminalRecord: criminalRecord?.record || null,
                imageCount: imageCount?.count || 0
            }
        });
    }));
    
    // GET /api/v1/stats/leaderboard/:type - Get leaderboards
    router.get('/leaderboard/:type', asyncHandler(async (req, res) => {
        const { type } = req.params;
        const { limit = 10 } = req.query;
        
        const validTypes = ['bongs', 'drinks', 'money', 'criminal', 'messages', 'images'];
        if (!validTypes.includes(type)) {
            throw new ValidationError(`Invalid leaderboard type. Must be one of: ${validTypes.join(', ')}`, 'type');
        }
        
        const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
        let query, data;
        
        switch (type) {
            case 'bongs':
                query = `
                    SELECT username, COUNT(*) as count
                    FROM user_bongs
                    GROUP BY username
                    ORDER BY count DESC
                    LIMIT ?
                `;
                break;
            
            case 'drinks':
                query = `
                    SELECT username, COUNT(*) as count
                    FROM user_drinks
                    GROUP BY username
                    ORDER BY count DESC
                    LIMIT ?
                `;
                break;
            
            case 'money':
                query = `
                    SELECT username, balance as count
                    FROM economy_users
                    ORDER BY balance DESC
                    LIMIT ?
                `;
                break;
            
            case 'criminal':
                query = `
                    SELECT username, record as description, created_at
                    FROM criminal_records
                    ORDER BY created_at DESC
                    LIMIT ?
                `;
                break;
            
            case 'messages':
                query = `
                    SELECT username, message_count as count
                    FROM user_stats
                    ORDER BY message_count DESC
                    LIMIT ?
                `;
                break;
            
            case 'images':
                query = `
                    SELECT username, COUNT(*) as count
                    FROM user_images
                    WHERE is_active = 1
                    GROUP BY username
                    ORDER BY count DESC
                    LIMIT ?
                `;
                break;
        }
        
        const results = await apiServer.bot.db.all(query, [limitNum]);
        
        // Format results based on type
        if (type === 'criminal') {
            data = results.map((row, index) => ({
                rank: index + 1,
                username: row.username,
                record: row.description,
                date: row.created_at
            }));
        } else {
            data = results.map((row, index) => ({
                rank: index + 1,
                username: row.username,
                count: row.count
            }));
        }
        
        res.json({
            success: true,
            data: {
                type,
                leaderboard: data
            }
        });
    }));
    
    // GET /api/v1/stats/channel - Get channel statistics
    router.get('/channel', asyncHandler(async (req, res) => {
        // Get various channel stats
        const [totalMessages, uniqueUsers, activeToday, totalBongs, totalDrinks] = await Promise.all([
            apiServer.bot.db.get('SELECT COUNT(*) as count FROM messages'),
            apiServer.bot.db.get('SELECT COUNT(*) as count FROM user_stats'),
            apiServer.bot.db.get(
                'SELECT COUNT(DISTINCT username) as count FROM messages WHERE timestamp > ?',
                [Date.now() - 86400000] // Last 24 hours
            ),
            apiServer.bot.db.get('SELECT COUNT(*) as count FROM user_bongs'),
            apiServer.bot.db.get('SELECT COUNT(*) as count FROM user_drinks')
        ]);
        
        // Get current video info if available
        const currentVideo = apiServer.bot.currentMedia?.title || null;
        const videoId = apiServer.bot.currentMedia?.id || null;
        
        // Calculate bot uptime
        const uptime = apiServer.bot.startTime ? Math.floor((Date.now() - apiServer.bot.startTime) / 1000) : 0;
        
        res.json({
            success: true,
            data: {
                totalMessages: totalMessages.count,
                uniqueUsers: uniqueUsers.count,
                activeToday: activeToday.count,
                currentVideo,
                videoId,
                uptime,
                stats: {
                    totalBongs: totalBongs.count,
                    totalDrinks: totalDrinks.count
                },
                connection: {
                    connected: apiServer.bot.connection?.connected || false,
                    channel: apiServer.bot.connection?.channel || null
                }
            }
        });
    }));
    
    // GET /api/v1/stats/daily/:type - Get daily statistics
    router.get('/daily/:type', asyncHandler(async (req, res) => {
        const { type } = req.params;
        const { days = 7 } = req.query;
        
        const validTypes = ['bongs', 'drinks', 'messages'];
        if (!validTypes.includes(type)) {
            throw new ValidationError(`Invalid daily stat type. Must be one of: ${validTypes.join(', ')}`, 'type');
        }
        
        const daysNum = Math.min(Math.max(parseInt(days) || 7, 1), 30);
        const cutoff = Date.now() - (daysNum * 86400000);
        
        let query;
        switch (type) {
            case 'bongs':
                query = `
                    SELECT 
                        date(timestamp / 1000, 'unixepoch') as date,
                        COUNT(*) as count
                    FROM user_bongs
                    WHERE timestamp > ?
                    GROUP BY date
                    ORDER BY date DESC
                `;
                break;
            
            case 'drinks':
                query = `
                    SELECT 
                        date(timestamp / 1000, 'unixepoch') as date,
                        COUNT(*) as count
                    FROM user_drinks
                    WHERE timestamp > ?
                    GROUP BY date
                    ORDER BY date DESC
                `;
                break;
            
            case 'messages':
                query = `
                    SELECT 
                        date(timestamp / 1000, 'unixepoch') as date,
                        COUNT(*) as count
                    FROM messages
                    WHERE timestamp > ?
                    GROUP BY date
                    ORDER BY date DESC
                `;
                break;
        }
        
        const results = await apiServer.bot.db.all(query, [cutoff]);
        
        res.json({
            success: true,
            data: {
                type,
                days: daysNum,
                daily: results.map(row => ({
                    date: row.date,
                    count: row.count
                }))
            }
        });
    }));
    
    // GET /api/v1/stats/recent/activity - Get recent channel activity
    router.get('/recent/activity', asyncHandler(async (req, res) => {
        const { limit = 20 } = req.query;
        const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        
        // Get recent messages
        const recentMessages = await apiServer.bot.db.all(`
            SELECT username, message, timestamp
            FROM messages
            ORDER BY timestamp DESC
            LIMIT ?
        `, [limitNum]);
        
        // Get recent user events
        const recentEvents = await apiServer.bot.db.all(`
            SELECT username, event_type, timestamp
            FROM user_events
            ORDER BY timestamp DESC
            LIMIT ?
        `, [limitNum]);
        
        res.json({
            success: true,
            data: {
                messages: recentMessages.map(msg => ({
                    username: msg.username,
                    message: msg.message,
                    timestamp: msg.timestamp
                })),
                events: recentEvents.map(evt => ({
                    username: evt.username,
                    type: evt.event_type,
                    timestamp: evt.timestamp
                }))
            }
        });
    }));
    
    // Register endpoints
    apiServer.registerEndpoint('GET', '/api/v1/stats/users/:username');
    apiServer.registerEndpoint('GET', '/api/v1/stats/leaderboard/:type');
    apiServer.registerEndpoint('GET', '/api/v1/stats/channel');
    apiServer.registerEndpoint('GET', '/api/v1/stats/daily/:type');
    apiServer.registerEndpoint('GET', '/api/v1/stats/recent/activity');
    
    return router;
}