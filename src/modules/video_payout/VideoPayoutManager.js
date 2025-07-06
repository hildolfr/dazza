import { createLogger } from '../../utils/LoggerCompatibilityLayer.js';
import EventEmitter from 'events';
import { normalizeUsernameForDb } from '../../utils/usernameNormalizer.js';

export class VideoPayoutManager extends EventEmitter {
    constructor(db, bot) {
        super();
        this.db = db;
        this.bot = bot;
        this.logger = createLogger('VideoPayoutManager');
        
        // Current session tracking - per room
        this.roomSessions = new Map(); // roomId -> { currentSession, currentWatchers, firstMediaChangeIgnored }
        
        // Reconciliation tracking - per room
        this.roomReconciliation = new Map(); // roomId -> { timeout, attempts, lastUpdate }
        
        // Initialize default room for backward compatibility
        this.initRoom('default');
        
        // Configuration
        this.config = {
            LUCKY_CHANCE: 0.02, // 2% chance for $3
            NORMAL_REWARD: 1,
            LUCKY_REWARD: 3
        };
    }

    initRoom(roomId) {
        if (!this.roomSessions.has(roomId)) {
            this.roomSessions.set(roomId, {
                currentSession: null,
                currentWatchers: new Map(),
                firstMediaChangeIgnored: false
            });
            
            this.roomReconciliation.set(roomId, {
                timeout: null,
                attempts: 0,
                lastUpdate: Date.now()
            });
        }
    }
    
    getRoomData(roomId) {
        // Ensure room is initialized
        this.initRoom(roomId);
        return this.roomSessions.get(roomId);
    }
    
    getRoomReconciliation(roomId) {
        // Ensure room is initialized
        this.initRoom(roomId);
        return this.roomReconciliation.get(roomId);
    }
    
    async init() {
        // Check for any incomplete sessions from previous run
        const incompleteSessions = await this.db.all(`
            SELECT * FROM video_sessions 
            WHERE end_time IS NULL 
            ORDER BY start_time DESC
        `);

        if (incompleteSessions.length > 0) {
            // Group sessions by room
            const sessionsByRoom = new Map();
            
            for (const session of incompleteSessions) {
                const roomId = session.room_id || 'default';
                if (!sessionsByRoom.has(roomId)) {
                    sessionsByRoom.set(roomId, []);
                }
                sessionsByRoom.get(roomId).push(session);
            }
            
            // Process each room's incomplete sessions
            for (const [roomId, sessions] of sessionsByRoom) {
                const session = sessions[0]; // Take the most recent
                const sessionAge = Date.now() - session.start_time;
                const TWO_HOURS = 2 * 60 * 60 * 1000;
                
                // Initialize room
                this.initRoom(roomId);
                const roomData = this.getRoomData(roomId);
                
                // Check if session is stale (older than 2 hours)
                if (sessionAge > TWO_HOURS) {
                    this.logger.info(`[${roomId}] Found stale video session (${Math.round(sessionAge / 60000)} minutes old), marking as abandoned: ${session.media_title}`);
                    
                    // Mark session as ended without rewards
                    await this.db.run(
                        'UPDATE video_sessions SET end_time = ?, duration = ? WHERE id = ?',
                        [Date.now(), sessionAge, session.id]
                    );
                    
                    // Mark all watchers as not rewarded due to stale session
                    await this.db.run(
                        'UPDATE video_watchers SET leave_time = ? WHERE session_id = ? AND leave_time IS NULL',
                        [Date.now(), session.id]
                    );
                    
                    this.logger.info(`[${roomId}] Stale session cleaned up, starting fresh`);
                } else {
                    this.logger.info(`[${roomId}] Resuming video session (${Math.round(sessionAge / 60000)} minutes old): ${session.media_title} (ID: ${session.id})`);
                    
                    // Restore session
                    roomData.currentSession = {
                        id: session.id,
                        startTime: session.start_time,
                        mediaInfo: {
                            id: session.media_id,
                            title: session.media_title
                        }
                    };
                
                    // Restore watchers who haven't left
                    const watchers = await this.db.all(`
                        SELECT DISTINCT username, join_time 
                        FROM video_watchers 
                        WHERE session_id = ? AND leave_time IS NULL AND rewarded = 0
                    `, [session.id]);
                    
                    for (const watcher of watchers) {
                        // Check if they're still in the channel
                        let userlist;
                        if (this.bot.getUserlist) {
                            // Single room bot
                            userlist = this.bot.getUserlist();
                        } else if (this.bot.getRoom) {
                            // Multi-room bot
                            const room = this.bot.getRoom(roomId);
                            userlist = room ? room.userlist : null;
                        }
                        
                        if (userlist && userlist.has(watcher.username.toLowerCase())) {
                            roomData.currentWatchers.set(watcher.username, watcher.join_time);
                            this.logger.debug(`[${roomId}] Restored watcher: ${watcher.username}`);
                        } else {
                            // Mark them as left since they're not in channel
                            await this.removeWatcher(watcher.username, roomId);
                        }
                    }
                    
                    this.logger.info(`[${roomId}] Restored ${roomData.currentWatchers.size} active watchers`);
                    
                    // Don't ignore first media change since we're resuming
                    roomData.firstMediaChangeIgnored = true;
                }
            }
        }
        
        this.logger.info('VideoPayoutManager initialized');
    }

    isSystemUser(username) {
        const lowerUsername = username.toLowerCase();
        return lowerUsername === 'dazza' || 
               lowerUsername === this.bot.config.bot.username.toLowerCase() ||
               lowerUsername === '[server]' ||
               lowerUsername.startsWith('[') && lowerUsername.endsWith(']');
    }

    async handleMediaChange(mediaInfo, roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        
        // Ignore the first media change as requested
        if (!roomData.firstMediaChangeIgnored) {
            roomData.firstMediaChangeIgnored = true;
            this.logger.debug(`[${roomId}] Ignoring first media change`);
            return;
        }

        // End current session and start new one
        if (roomData.currentSession) {
            await this.endSession(roomId);
        }

        await this.startSession(mediaInfo, roomId);
    }

    async startSession(mediaInfo, roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        const startTime = Date.now();
        
        // Create new session with room_id
        const result = await this.db.run(
            'INSERT INTO video_sessions (media_id, media_title, start_time, room_id) VALUES (?, ?, ?, ?)',
            [mediaInfo.id || 'unknown', mediaInfo.title || 'Untitled', startTime, roomId]
        );

        roomData.currentSession = {
            id: result.lastID,
            startTime: startTime,
            mediaInfo: mediaInfo
        };

        // Clear existing watchers for new session
        roomData.currentWatchers.clear();
        
        // Initial reconciliation (might be incomplete due to race condition)
        await this.reconcileWatchers('initial', roomId);
        
        // Schedule additional reconciliation attempts
        this.scheduleReconciliation(roomId);

        this.logger.info(`[${roomId}] Started new video session: ${mediaInfo.title || 'Untitled'} with ${roomData.currentWatchers.size} watchers (reconciliation pending)`);
    }

    async endSession(roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        const reconciliation = this.getRoomReconciliation(roomId);
        
        if (!roomData.currentSession) return;

        // Clear any pending reconciliation
        if (reconciliation.timeout) {
            clearTimeout(reconciliation.timeout);
            reconciliation.timeout = null;
        }

        const endTime = Date.now();
        const duration = endTime - roomData.currentSession.startTime;
        const halfwayMark = roomData.currentSession.startTime + (duration / 2);

        // Update session end time and duration
        await this.db.run(
            'UPDATE video_sessions SET end_time = ?, duration = ? WHERE id = ?',
            [endTime, duration, roomData.currentSession.id]
        );

        // Process rewards for eligible watchers
        let rewardCount = 0;
        let totalPayout = 0;

        for (const [username, joinTime] of roomData.currentWatchers) {
            // Check if user joined before halfway mark
            if (joinTime <= halfwayMark) {
                const reward = await this.rewardUser(username, roomData.currentSession.id);
                if (reward > 0) {
                    rewardCount++;
                    totalPayout += reward;
                }
            } else {
                this.logger.debug(`[${roomId}] Skipping ${username} - joined after halfway mark`);
            }
        }

        this.logger.info(`[${roomId}] Session ended: ${rewardCount} users rewarded, total payout: $${totalPayout}`);
        roomData.currentSession = null;
        roomData.currentWatchers.clear();
    }

    async addWatcher(username, joinTime, roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        
        if (!roomData.currentSession || this.isSystemUser(username)) return;

        const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
        
        // Check if watcher already exists for this session
        const existing = await this.db.get(
            'SELECT id FROM video_watchers WHERE session_id = ? AND username = ? AND leave_time IS NULL',
            [roomData.currentSession.id, canonicalUsername]
        );
        
        // Only insert if not already present
        if (!existing) {
            await this.db.run(
                'INSERT INTO video_watchers (session_id, username, join_time) VALUES (?, ?, ?)',
                [roomData.currentSession.id, canonicalUsername, joinTime]
            );
        }

        roomData.currentWatchers.set(username, joinTime);
    }

    async removeWatcher(username, roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        
        if (!roomData.currentSession || !roomData.currentWatchers.has(username)) return;

        const leaveTime = Date.now();
        const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
        
        await this.db.run(
            'UPDATE video_watchers SET leave_time = ? WHERE session_id = ? AND LOWER(username) = LOWER(?) AND leave_time IS NULL',
            [leaveTime, roomData.currentSession.id, canonicalUsername]
        );

        roomData.currentWatchers.delete(username);
    }

    async rewardUser(username, sessionId) {
        // Determine reward amount
        const isLucky = Math.random() < this.config.LUCKY_CHANCE;
        const rewardAmount = isLucky ? this.config.LUCKY_REWARD : this.config.NORMAL_REWARD;

        const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
        
        // Ensure user exists in economy system
        await this.bot.heistManager.getOrCreateUser(canonicalUsername);
        
        // Update user balance (no trust change for video watching)
        await this.bot.heistManager.updateUserEconomy(canonicalUsername, rewardAmount, 0);

        // Mark as rewarded - only update the active record (without leave_time)
        await this.db.run(
            'UPDATE video_watchers SET rewarded = 1, reward_amount = ? WHERE session_id = ? AND username = ? AND leave_time IS NULL',
            [rewardAmount, sessionId, canonicalUsername]
        );

        this.logger.debug(`Rewarded ${username}: $${rewardAmount}${isLucky ? ' (LUCKY!)' : ''}`);
        return rewardAmount;
    }

    async handleUserJoin(username, roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        
        if (!roomData.currentSession || this.isSystemUser(username)) return;

        // Just add the watcher with current time
        // The reconciliation process will handle race conditions
        const joinTime = Date.now();
        if (!roomData.currentWatchers.has(username)) {
            roomData.currentWatchers.set(username, joinTime);
            await this.addWatcher(username, joinTime, roomId);
            this.logger.debug(`[${roomId}] ${username} joined video session`);
        }
    }

    async handleUserLeave(username, roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        
        if (roomData.currentWatchers.has(username)) {
            await this.removeWatcher(username, roomId);
            this.logger.debug(`[${roomId}] ${username} left video session`);
        }
    }

    // Get user's video watching stats
    async getUserStats(username) {
        try {
            // For video stats, we just need to match case-insensitively
            // No need to normalize since we're using LOWER() in the query
            
            const stats = await this.db.get(`
                SELECT 
                    COUNT(DISTINCT session_id) as videos_watched,
                    COALESCE(SUM(reward_amount), 0) as total_earned,
                    COUNT(CASE WHEN reward_amount = ? THEN 1 END) as lucky_rewards
                FROM video_watchers 
                WHERE LOWER(username) = LOWER(?) AND rewarded = 1
            `, [this.config.LUCKY_REWARD, username]);

            // Log for debugging
            this.logger.info(`Video stats for ${username}:`, stats);
            
            // Ensure we always return an object with the expected properties
            return {
                videos_watched: stats?.videos_watched || 0,
                total_earned: stats?.total_earned || 0,
                lucky_rewards: stats?.lucky_rewards || 0
            };
        } catch (error) {
            this.logger.error('Error getting user video stats:', error);
            return {
                videos_watched: 0,
                total_earned: 0,
                lucky_rewards: 0
            };
        }
    }
    
    async reconcileWatchers(source = 'reconciliation', roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        
        if (!roomData.currentSession) return;

        // Get userlist for the room
        let userlist;
        if (this.bot.getUserlist) {
            // Single room bot
            userlist = this.bot.getUserlist();
        } else if (this.bot.getRoom) {
            // Multi-room bot
            const room = this.bot.getRoom(roomId);
            userlist = room ? room.userlist : null;
        }
        
        if (!userlist) return;
        
        const currentUsers = new Set();
        let addedCount = 0;
        let removedCount = 0;
        
        // Get current users from userlist
        for (const [username, userInfo] of userlist) {
            if (!this.isSystemUser(username)) {
                currentUsers.add(username);
            }
        }

        // Add new watchers who aren't tracked yet
        for (const username of currentUsers) {
            if (!roomData.currentWatchers.has(username)) {
                // Use session start time for reconciled users to ensure they're eligible
                // This handles the race condition where users were present but not tracked
                const joinTime = roomData.currentSession.startTime;
                roomData.currentWatchers.set(username, joinTime);
                await this.addWatcher(username, joinTime, roomId);
                addedCount++;
                this.logger.debug(`[${roomId}] Added watcher during ${source}: ${username}`);
            }
        }

        // Remove watchers who left
        for (const [username, joinTime] of roomData.currentWatchers) {
            if (!currentUsers.has(username)) {
                await this.removeWatcher(username, roomId);
                removedCount++;
                this.logger.debug(`[${roomId}] Removed watcher during ${source}: ${username}`);
            }
        }

        if (addedCount > 0 || removedCount > 0) {
            this.logger.info(`[${roomId}] Reconciliation (${source}): ${roomData.currentWatchers.size} watchers (+${addedCount}/-${removedCount})`);
        }
    }
    
    scheduleReconciliation(roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        const reconciliation = this.getRoomReconciliation(roomId);
        
        reconciliation.attempts = 0;
        
        const attemptReconciliation = async () => {
            if (!roomData.currentSession || reconciliation.attempts >= this.maxReconciliationAttempts) {
                return;
            }

            reconciliation.attempts++;
            await this.reconcileWatchers(`attempt ${reconciliation.attempts}`, roomId);

            // Schedule next attempt with exponential backoff
            if (reconciliation.attempts < this.maxReconciliationAttempts) {
                const delay = Math.pow(2, reconciliation.attempts) * 1000; // 2s, 4s, 8s
                reconciliation.timeout = setTimeout(attemptReconciliation, delay);
            }
        };

        // First reconciliation after 2 seconds
        reconciliation.timeout = setTimeout(attemptReconciliation, 2000);
    }
    
    async handleUserlistUpdate(roomId = 'default') {
        const roomData = this.getRoomData(roomId);
        const reconciliation = this.getRoomReconciliation(roomId);
        
        reconciliation.lastUpdate = Date.now();
        
        // Reconcile whenever we get a userlist update
        if (roomData.currentSession) {
            await this.reconcileWatchers('userlist_update', roomId);
            
            // Cancel remaining scheduled reconciliations if we have watchers
            if (roomData.currentWatchers.size > 0 && reconciliation.timeout) {
                clearTimeout(reconciliation.timeout);
                reconciliation.timeout = null;
                this.logger.debug(`[${roomId}] Cancelled remaining reconciliation attempts - userlist updated`);
            }
        }
    }
    
    // Clean shutdown - preserve state but don't reward yet
    async shutdown() {
        // Clear all reconciliation timeouts
        for (const [roomId, reconciliation] of this.roomReconciliation) {
            if (reconciliation.timeout) {
                clearTimeout(reconciliation.timeout);
                reconciliation.timeout = null;
            }
        }
        
        // Log preserved sessions
        for (const [roomId, roomData] of this.roomSessions) {
            if (roomData.currentSession) {
                this.logger.info(`[${roomId}] Preserving video session state for: ${roomData.currentSession.mediaInfo.title}`);
                // Don't end the session, just save current state
                // The session will be resumed on next startup
            }
        }
    }
}