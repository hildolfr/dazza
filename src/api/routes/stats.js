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
    
    // GET /api/v1/stats/leaderboard/all - Get all leaderboards at once
    router.get('/leaderboard/all', asyncHandler(async (req, res) => {
        const { limit = 5 } = req.query;
        const limitNum = Math.min(Math.max(parseInt(limit) || 5, 1), 10);
        
        // Define all leaderboard types with their titles
        const leaderboardTypes = [
            { type: 'talkers', title: 'Top Yappers' },
            { type: 'bongs', title: '🌿 Most Cooked Cunts' },
            { type: 'drinks', title: '🍺 Top Piss-heads' },
            { type: 'quoted', title: '💬 Quotable Legends' },
            { type: 'gamblers', title: '🎰 Lucky Bastards' },
            { type: 'fishing', title: '🎣 Master Baiters' },
            { type: 'bottles', title: '♻️ Eco Warriors' },
            { type: 'cashie', title: '💪 Hardest Workers' },
            { type: 'sign_spinning', title: '🪧 Sign Spinners' },
            { type: 'beggars', title: '🤲 Shameless Beggars' },
            { type: 'pissers', title: '🏆 Top Pissers' }
        ];
        
        // Fetch all leaderboards in parallel
        const allLeaderboards = await Promise.all(
            leaderboardTypes.map(async ({ type, title }) => {
                try {
                    let results;
                    switch (type) {
                        case 'talkers':
                            results = await apiServer.bot.db.getTopTalkers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.message_count} messages`
                                }))
                            };
                        case 'bongs':
                            results = await apiServer.bot.db.getTopBongUsers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.bong_count} cones`,
                                    achievement: r.bong_count >= 100 ? '💀' : null
                                }))
                            };
                        case 'drinks':
                            results = await apiServer.bot.db.getTopDrinkers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.drink_count} drinks`,
                                    achievement: r.drink_count >= 500 ? '💀' : r.drink_count >= 100 ? '🍺' : null
                                }))
                            };
                        case 'quoted':
                            results = await apiServer.bot.db.getTopQuotedUsers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.quotable_messages} bangers`
                                }))
                            };
                        case 'gamblers':
                            results = await apiServer.bot.db.getTopGamblers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `$${r.biggest_win}`,
                                    extra: r.transaction_type,
                                    achievement: r.biggest_win >= 1000 ? '💰' : null
                                }))
                            };
                        case 'fishing':
                            results = await apiServer.bot.db.getTopFishers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.biggest_catch}kg ${r.fish_type || ''}`,
                                    achievement: r.biggest_catch >= 10 ? '🐋' : r.biggest_catch >= 5 ? '🦈' : null
                                }))
                            };
                        case 'bottles':
                            results = await apiServer.bot.db.getTopBottleCollectors(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `$${r.total_earnings}`,
                                    extra: `${r.collection_count} runs`,
                                    achievement: r.total_earnings >= 1000 ? '🏆' : r.total_earnings >= 500 ? '💰' : null
                                }))
                            };
                        case 'cashie':
                            results = await apiServer.bot.db.getTopCashieWorkers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `$${r.total_earnings}`,
                                    extra: `${r.job_count} jobs`,
                                    achievement: r.total_earnings >= 3000 ? '🤑' : r.total_earnings >= 1500 ? '💸' : null
                                }))
                            };
                        case 'sign_spinning':
                            results = await apiServer.bot.db.getTopSignSpinners(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `$${r.total_earnings}`,
                                    extra: `${r.total_spins} shifts`,
                                    achievement: r.perfect_days > 0 ? '🌟' : null
                                }))
                            };
                        case 'beggars':
                            results = await apiServer.bot.db.getTopBeggars(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.times_begged} begs`,
                                    extra: `$${r.total_received} received`,
                                    achievement: r.times_begged >= 20 ? '🤡💩' : r.times_begged >= 10 ? '🤡' : null
                                }))
                            };
                        case 'pissers':
                            results = await apiServer.bot.db.getTopPissers(limitNum);
                            return {
                                type,
                                title,
                                data: results.map((r, i) => ({
                                    rank: i + 1,
                                    username: r.username,
                                    value: `${r.wins}W/${r.losses}L`,
                                    extra: r.best_distance >= 4.5 ? `📏${r.best_distance.toFixed(1)}m` : null,
                                    achievement: r.wins >= 50 ? '👑' : r.wins >= 25 ? '⭐' : null
                                }))
                            };
                    }
                } catch (error) {
                    console.error(`Error fetching ${type} leaderboard:`, error);
                    return { type, title, error: true, data: [] };
                }
            })
        );
        
        res.json({
            success: true,
            data: {
                leaderboards: allLeaderboards
            }
        });
    }));
    
    // GET /api/v1/stats/leaderboard/:type - Get leaderboards
    router.get('/leaderboard/:type', asyncHandler(async (req, res) => {
        const { type } = req.params;
        const { limit = 10 } = req.query;
        
        const validTypes = ['talkers', 'bongs', 'drinks', 'quoted', 'gamblers', 'fishing', 
                          'bottles', 'cashie', 'sign_spinning', 'beggars', 'pissers',
                          'money', 'criminal', 'messages', 'images'];
        if (!validTypes.includes(type)) {
            throw new ValidationError(`Invalid leaderboard type. Must be one of: ${validTypes.join(', ')}`, 'type');
        }
        
        const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
        let results, data;
        
        switch (type) {
            case 'talkers':
                results = await apiServer.bot.db.getTopTalkers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.message_count,
                    label: 'messages'
                }));
                break;
                
            case 'bongs':
                results = await apiServer.bot.db.getTopBongUsers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.bong_count,
                    label: 'cones',
                    achievement: row.bong_count >= 100 ? '💀' : null
                }));
                break;
            
            case 'drinks':
                results = await apiServer.bot.db.getTopDrinkers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.drink_count,
                    label: 'drinks',
                    achievement: row.drink_count >= 500 ? '💀' : row.drink_count >= 100 ? '🍺' : null
                }));
                break;
                
            case 'quoted':
                results = await apiServer.bot.db.getTopQuotedUsers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.quotable_messages,
                    label: 'bangers'
                }));
                break;
                
            case 'gamblers':
                results = await apiServer.bot.db.getTopGamblers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    amount: row.biggest_win,
                    gameType: row.transaction_type,
                    achievement: row.biggest_win >= 1000 ? '💰' : null
                }));
                break;
                
            case 'fishing':
                results = await apiServer.bot.db.getTopFishers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    weight: row.biggest_catch,
                    fishType: row.fish_type || 'Unknown',
                    achievement: row.biggest_catch >= 10 ? '🐋' : row.biggest_catch >= 5 ? '🦈' : null
                }));
                break;
                
            case 'bottles':
                results = await apiServer.bot.db.getTopBottleCollectors(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    totalEarnings: row.total_earnings,
                    collectionCount: row.collection_count,
                    avgPerRun: row.avg_per_run,
                    achievement: row.total_earnings >= 1000 ? '🏆' : row.total_earnings >= 500 ? '💰' : null
                }));
                break;
                
            case 'cashie':
                results = await apiServer.bot.db.getTopCashieWorkers(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    totalEarnings: row.total_earnings,
                    jobCount: row.job_count,
                    avgPerJob: row.avg_per_job,
                    achievement: row.total_earnings >= 3000 ? '🤑' : row.total_earnings >= 1500 ? '💸' : row.total_earnings >= 500 ? '💰' : null
                }));
                break;
                
            case 'sign_spinning':
                results = await apiServer.bot.db.getTopSignSpinners(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    totalEarnings: row.total_earnings,
                    totalSpins: row.total_spins,
                    perfectDays: row.perfect_days,
                    copsCalled: row.cops_called,
                    avgPerShift: row.avg_per_shift,
                    achievement: row.perfect_days > 0 ? '🌟' : row.best_shift >= 100 ? '💪' : null
                }));
                break;
                
            case 'beggars':
                results = await apiServer.bot.db.getTopBeggars(limitNum);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    timesBegged: row.times_begged,
                    totalReceived: row.total_received,
                    successRate: Math.round(row.success_rate),
                    timesRobbed: row.times_robbed,
                    achievement: row.times_begged >= 20 ? '🤡💩' : row.times_begged >= 10 ? '🤡' : row.times_begged >= 5 ? '😔' : null
                }));
                break;
                
            case 'pissers':
                results = await apiServer.bot.db.getTopPissers(limitNum);
                data = results.map((row, index) => {
                    const winRate = row.win_rate ? row.win_rate.toFixed(1) : '0';
                    let specialty = null;
                    
                    if (row.best_distance >= 4.5) {
                        specialty = { type: 'distance', value: `${row.best_distance.toFixed(1)}m`, title: 'Fire Hose' };
                    } else if (row.best_aim >= 95) {
                        specialty = { type: 'aim', value: `${Math.round(row.best_aim)}%`, title: 'Sniper' };
                    } else if (row.best_duration >= 25) {
                        specialty = { type: 'duration', value: `${Math.round(row.best_duration)}s`, title: 'Marathon Man' };
                    } else if (row.best_volume >= 1800) {
                        specialty = { type: 'volume', value: `${Math.round(row.best_volume)}mL`, title: 'The Camel' };
                    }
                    
                    return {
                        rank: index + 1,
                        username: row.username,
                        wins: row.wins,
                        losses: row.losses,
                        winRate: parseFloat(winRate),
                        moneyWon: row.money_won,
                        specialty,
                        achievement: row.wins >= 50 ? '👑' : row.wins >= 25 ? '⭐' : null
                    };
                });
                break;
            
            case 'money':
                results = await apiServer.bot.db.all(`
                    SELECT username, balance as count
                    FROM economy_users
                    ORDER BY balance DESC
                    LIMIT ?
                `, [limitNum]);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.count,
                    label: 'dollarydoos'
                }));
                break;
            
            case 'criminal':
                results = await apiServer.bot.db.all(`
                    SELECT username, record as description, created_at
                    FROM criminal_records
                    ORDER BY created_at DESC
                    LIMIT ?
                `, [limitNum]);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    record: row.description,
                    date: row.created_at
                }));
                break;
            
            case 'messages':
                results = await apiServer.bot.db.all(`
                    SELECT username, message_count as count
                    FROM user_stats
                    ORDER BY message_count DESC
                    LIMIT ?
                `, [limitNum]);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.count,
                    label: 'messages'
                }));
                break;
            
            case 'images':
                results = await apiServer.bot.db.all(`
                    SELECT username, COUNT(*) as count
                    FROM user_images
                    WHERE is_active = 1
                    GROUP BY username
                    ORDER BY count DESC
                    LIMIT ?
                `, [limitNum]);
                data = results.map((row, index) => ({
                    rank: index + 1,
                    username: row.username,
                    count: row.count,
                    label: 'images'
                }));
                break;
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
    
    // GET /api/v1/stats/users/:username/category/:category - Get detailed user stats for a specific category
    router.get('/users/:username/category/:category', asyncHandler(async (req, res) => {
        const { username, category } = req.params;
        const normalizedUsername = username.toLowerCase();
        
        let data = {};
        
        try {
            switch (category) {
                case 'pissers':
                    const pissingStats = await apiServer.bot.db.get(
                        'SELECT * FROM pissing_contest_stats WHERE LOWER(username) = ?',
                        [normalizedUsername]
                    );
                    
                    if (pissingStats) {
                        // Get recent matches
                        const recentMatches = await apiServer.bot.db.all(`
                            SELECT * FROM pissing_contest_challenges 
                            WHERE (LOWER(challenger) = ? OR LOWER(challenged) = ?)
                            AND status = 'completed'
                            ORDER BY completed_at DESC
                            LIMIT 5
                        `, [normalizedUsername, normalizedUsername]);
                        
                        // Get records
                        const records = await apiServer.bot.db.all(`
                            SELECT * FROM pissing_contest_records
                            WHERE LOWER(username) = ?
                        `, [normalizedUsername]);
                        
                        data = {
                            stats: pissingStats,
                            recentMatches: recentMatches.map(match => ({
                                opponent: match.challenger.toLowerCase() === normalizedUsername ? match.challenged : match.challenger,
                                won: match.winner?.toLowerCase() === normalizedUsername,
                                amount: match.amount,
                                date: match.completed_at,
                                performance: {
                                    distance: match.challenger.toLowerCase() === normalizedUsername ? match.challenger_distance : match.challenged_distance,
                                    volume: match.challenger.toLowerCase() === normalizedUsername ? match.challenger_volume : match.challenged_volume,
                                    aim: match.challenger.toLowerCase() === normalizedUsername ? match.challenger_aim : match.challenged_aim,
                                    duration: match.challenger.toLowerCase() === normalizedUsername ? match.challenger_duration : match.challenged_duration
                                }
                            })),
                            records: records
                        };
                    }
                    break;
                    
                case 'sign_spinning':
                    const spinStats = await apiServer.bot.db.get(
                        'SELECT * FROM sign_spinning_stats WHERE LOWER(username) = ?',
                        [normalizedUsername]
                    );
                    
                    if (spinStats) {
                        // Get recent shifts from transactions
                        const recentShifts = await apiServer.bot.db.all(`
                            SELECT * FROM economy_transactions
                            WHERE LOWER(username) = ? AND transaction_type = 'sign_spinning'
                            ORDER BY timestamp DESC
                            LIMIT 10
                        `, [normalizedUsername]);
                        
                        data = {
                            stats: spinStats,
                            recentShifts: recentShifts,
                            efficiency: spinStats.total_spins > 0 ? (spinStats.total_earnings / spinStats.total_spins).toFixed(2) : 0,
                            copRate: spinStats.total_spins > 0 ? ((spinStats.cops_called / spinStats.total_spins) * 100).toFixed(1) : 0
                        };
                    }
                    break;
                    
                case 'gamblers':
                    // Get all gambling wins
                    const allWins = await apiServer.bot.db.all(`
                        SELECT transaction_type as game, amount, description, timestamp
                        FROM economy_transactions
                        WHERE LOWER(username) = ? 
                        AND transaction_type IN ('pokies', 'scratchie', 'tab')
                        AND amount > 0
                        ORDER BY amount DESC
                        LIMIT 20
                    `, [normalizedUsername]);
                    
                    // Get total stats per game
                    const gameStats = await apiServer.bot.db.all(`
                        SELECT 
                            transaction_type as game,
                            COUNT(*) as plays,
                            SUM(CASE WHEN amount > 0 THEN 1 ELSE 0 END) as wins,
                            SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) as losses,
                            SUM(amount) as net_profit,
                            MAX(amount) as biggest_win
                        FROM economy_transactions
                        WHERE LOWER(username) = ?
                        AND transaction_type IN ('pokies', 'scratchie', 'tab')
                        GROUP BY transaction_type
                    `, [normalizedUsername]);
                    
                    data = {
                        topWins: allWins,
                        gameStats: gameStats,
                        totalGames: gameStats.reduce((sum, g) => sum + g.plays, 0),
                        totalProfit: gameStats.reduce((sum, g) => sum + g.net_profit, 0)
                    };
                    break;
                    
                case 'fishing':
                    // Get all catches
                    const catches = await apiServer.bot.db.all(`
                        SELECT 
                            description,
                            amount,
                            timestamp,
                            CAST(SUBSTR(description, 1, INSTR(description, 'kg') - 1) AS REAL) as weight,
                            SUBSTR(description, INSTR(description, 'kg') + 3) as fish_type
                        FROM economy_transactions
                        WHERE LOWER(username) = ? AND transaction_type = 'fishing'
                        AND description LIKE '%kg%'
                        ORDER BY weight DESC
                        LIMIT 50
                    `, [normalizedUsername]);
                    
                    // Get fish type counts
                    const fishTypes = await apiServer.bot.db.all(`
                        SELECT 
                            SUBSTR(description, INSTR(description, 'kg') + 3) as fish_type,
                            COUNT(*) as count,
                            SUM(CAST(SUBSTR(description, 1, INSTR(description, 'kg') - 1) AS REAL)) as total_weight,
                            MAX(CAST(SUBSTR(description, 1, INSTR(description, 'kg') - 1) AS REAL)) as biggest
                        FROM economy_transactions
                        WHERE LOWER(username) = ? AND transaction_type = 'fishing'
                        AND description LIKE '%kg%'
                        GROUP BY fish_type
                        ORDER BY count DESC
                    `, [normalizedUsername]);
                    
                    data = {
                        topCatches: catches.slice(0, 10),
                        fishTypes: fishTypes,
                        totalCatches: catches.length,
                        totalWeight: catches.reduce((sum, c) => sum + c.weight, 0).toFixed(1)
                    };
                    break;
                    
                case 'beggars':
                    const begStats = await apiServer.bot.db.all(`
                        SELECT 
                            DATE(timestamp/1000, 'unixepoch') as date,
                            COUNT(*) as attempts,
                            SUM(CASE WHEN amount > 0 THEN 1 ELSE 0 END) as successes,
                            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as earned,
                            SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) as robbed,
                            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as lost
                        FROM economy_transactions
                        WHERE LOWER(username) = ? AND transaction_type = 'beg'
                        GROUP BY date
                        ORDER BY date DESC
                        LIMIT 30
                    `, [normalizedUsername]);
                    
                    const allTimeBeg = await apiServer.bot.db.get(`
                        SELECT 
                            COUNT(*) as total_begs,
                            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_lost,
                            MAX(CASE WHEN amount > 0 THEN amount ELSE 0 END) as best_handout,
                            MAX(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as worst_robbery
                        FROM economy_transactions
                        WHERE LOWER(username) = ? AND transaction_type = 'beg'
                    `, [normalizedUsername]);
                    
                    data = {
                        dailyStats: begStats,
                        allTime: allTimeBeg,
                        avgPerDay: begStats.length > 0 ? (allTimeBeg.total_begs / begStats.length).toFixed(1) : 0
                    };
                    break;
                    
                case 'bottles':
                case 'cashie':
                    const jobType = category === 'bottles' ? 'bottles' : 'cashie';
                    const jobStats = await apiServer.bot.db.all(`
                        SELECT 
                            DATE(timestamp/1000, 'unixepoch') as date,
                            COUNT(*) as jobs,
                            SUM(amount) as earned,
                            AVG(amount) as avg_per_job,
                            MAX(amount) as best_job
                        FROM economy_transactions
                        WHERE LOWER(username) = ? AND transaction_type = ?
                        AND amount > 0
                        GROUP BY date
                        ORDER BY date DESC
                        LIMIT 30
                    `, [normalizedUsername, jobType]);
                    
                    const allTimeJob = await apiServer.bot.db.get(`
                        SELECT 
                            COUNT(*) as total_jobs,
                            SUM(amount) as total_earned,
                            AVG(amount) as avg_per_job,
                            MAX(amount) as best_job
                        FROM economy_transactions
                        WHERE LOWER(username) = ? AND transaction_type = ?
                        AND amount > 0
                    `, [normalizedUsername, jobType]);
                    
                    data = {
                        dailyStats: jobStats,
                        allTime: allTimeJob,
                        avgPerDay: jobStats.length > 0 ? (allTimeJob.total_jobs / jobStats.length).toFixed(1) : 0
                    };
                    break;
                    
                default:
                    // For simple counters (talkers, bongs, drinks, quoted)
                    const basicStats = await apiServer.bot.db.get(
                        'SELECT * FROM user_stats WHERE LOWER(username) = ?',
                        [normalizedUsername]
                    );
                    
                    if (category === 'bongs' || category === 'drinks') {
                        const tableName = category === 'bongs' ? 'user_bongs' : 'user_drinks';
                        const dailyStats = await apiServer.bot.db.all(`
                            SELECT 
                                DATE(timestamp/1000, 'unixepoch') as date,
                                COUNT(*) as count
                            FROM ${tableName}
                            WHERE LOWER(username) = ?
                            GROUP BY date
                            ORDER BY date DESC
                            LIMIT 30
                        `, [normalizedUsername]);
                        
                        data = {
                            basicStats,
                            dailyStats,
                            avgPerDay: dailyStats.length > 0 
                                ? (dailyStats.reduce((sum, d) => sum + d.count, 0) / dailyStats.length).toFixed(1)
                                : 0
                        };
                    } else {
                        data = { basicStats };
                    }
            }
            
            if (Object.keys(data).length === 0) {
                throw new NotFoundError(`No ${category} stats found for user`);
            }
            
            res.json({
                success: true,
                data: {
                    username: normalizedUsername,
                    category,
                    ...data
                }
            });
            
        } catch (error) {
            console.error(`Error fetching ${category} stats for ${username}:`, error);
            throw error;
        }
    }));
    
    // GET /api/v1/stats/users/:username/ranks - Get user's position across all leaderboards
    router.get('/users/:username/ranks', asyncHandler(async (req, res) => {
        const { username } = req.params;
        const normalizedUsername = username.toLowerCase();
        
        // Check if user exists
        const userExists = await apiServer.bot.db.get(
            'SELECT username FROM user_stats WHERE LOWER(username) = ?',
            [normalizedUsername]
        );
        
        if (!userExists) {
            throw new NotFoundError('User');
        }
        
        // Get user's ranks in all leaderboards
        const ranks = {};
        
        // Helper function to find user's rank
        const findUserRank = (results, username, valueExtractor) => {
            const index = results.findIndex(r => r.username.toLowerCase() === username.toLowerCase());
            if (index === -1) return null;
            return {
                rank: index + 1,
                value: valueExtractor(results[index]),
                total: results.length
            };
        };
        
        // Fetch all ranks
        const [talkers, bongs, drinks, quoted, gamblers, fishing, bottles, cashie, signSpinning, beggars, pissers] = await Promise.all([
            apiServer.bot.db.getTopTalkers(100),
            apiServer.bot.db.getTopBongUsers(100),
            apiServer.bot.db.getTopDrinkers(100),
            apiServer.bot.db.getTopQuotedUsers(100),
            apiServer.bot.db.getTopGamblers(100),
            apiServer.bot.db.getTopFishers(100),
            apiServer.bot.db.getTopBottleCollectors(100),
            apiServer.bot.db.getTopCashieWorkers(100),
            apiServer.bot.db.getTopSignSpinners(100),
            apiServer.bot.db.getTopBeggars(100),
            apiServer.bot.db.getTopPissers(100)
        ]);
        
        ranks.talkers = findUserRank(talkers, normalizedUsername, r => `${r.message_count} messages`);
        ranks.bongs = findUserRank(bongs, normalizedUsername, r => `${r.bong_count} cones`);
        ranks.drinks = findUserRank(drinks, normalizedUsername, r => `${r.drink_count} drinks`);
        ranks.quoted = findUserRank(quoted, normalizedUsername, r => `${r.quotable_messages} bangers`);
        ranks.gamblers = findUserRank(gamblers, normalizedUsername, r => `$${r.biggest_win}`);
        ranks.fishing = findUserRank(fishing, normalizedUsername, r => `${r.biggest_catch}kg`);
        ranks.bottles = findUserRank(bottles, normalizedUsername, r => `$${r.total_earnings}`);
        ranks.cashie = findUserRank(cashie, normalizedUsername, r => `$${r.total_earnings}`);
        ranks.signSpinning = findUserRank(signSpinning, normalizedUsername, r => `$${r.total_earnings}`);
        ranks.beggars = findUserRank(beggars, normalizedUsername, r => `${r.times_begged} begs`);
        ranks.pissers = findUserRank(pissers, normalizedUsername, r => `${r.wins} wins`);
        
        res.json({
            success: true,
            data: {
                username: normalizedUsername,
                ranks
            }
        });
    }));
    
    // Register endpoints
    apiServer.registerEndpoint('GET', '/api/v1/stats/users/:username');
    apiServer.registerEndpoint('GET', '/api/v1/stats/users/:username/ranks');
    apiServer.registerEndpoint('GET', '/api/v1/stats/users/:username/category/:category');
    apiServer.registerEndpoint('GET', '/api/v1/stats/leaderboard/all');
    apiServer.registerEndpoint('GET', '/api/v1/stats/leaderboard/:type');
    apiServer.registerEndpoint('GET', '/api/v1/stats/channel');
    apiServer.registerEndpoint('GET', '/api/v1/stats/daily/:type');
    apiServer.registerEndpoint('GET', '/api/v1/stats/recent/activity');
    
    return router;
}