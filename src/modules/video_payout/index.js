import { createLogger } from '../../utils/logger.js';
import EventEmitter from 'events';

export class VideoPayoutManager extends EventEmitter {
    constructor(db, bot) {
        super();
        this.db = db;
        this.bot = bot;
        this.logger = createLogger('VideoPayoutManager');
        
        // Current session tracking
        this.currentSession = null;
        this.currentWatchers = new Map(); // username -> join_time
        this.firstMediaChangeIgnored = false;
        
        // Configuration
        this.config = {
            LUCKY_CHANCE: 0.02, // 2% chance for $3
            NORMAL_REWARD: 1,
            LUCKY_REWARD: 3
        };
    }

    async init() {
        // Check for any incomplete sessions from previous run
        const incompleteSessions = await this.db.all(`
            SELECT * FROM video_sessions 
            WHERE end_time IS NULL 
            ORDER BY start_time DESC 
            LIMIT 1
        `);

        if (incompleteSessions.length > 0) {
            const session = incompleteSessions[0];
            const sessionAge = Date.now() - session.start_time;
            const TWO_HOURS = 2 * 60 * 60 * 1000;
            
            // Check if session is stale (older than 2 hours)
            if (sessionAge > TWO_HOURS) {
                this.logger.info(`Found stale video session (${Math.round(sessionAge / 60000)} minutes old), marking as abandoned: ${session.media_title}`);
                
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
                
                this.logger.info('Stale session cleaned up, starting fresh');
            } else {
                this.logger.info(`Resuming video session (${Math.round(sessionAge / 60000)} minutes old): ${session.media_title} (ID: ${session.id})`);
                
                // Restore session
                this.currentSession = {
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
                    const userlist = this.bot.getUserlist();
                    if (userlist.has(watcher.username.toLowerCase())) {
                        this.currentWatchers.set(watcher.username, watcher.join_time);
                        this.logger.debug(`Restored watcher: ${watcher.username}`);
                    } else {
                        // Mark them as left since they're not in channel
                        await this.removeWatcher(watcher.username);
                    }
                }
                
                this.logger.info(`Restored ${this.currentWatchers.size} active watchers`);
                
                // Don't ignore first media change since we're resuming
                this.firstMediaChangeIgnored = true;
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

    async handleMediaChange(mediaInfo) {
        // Ignore the first media change as requested
        if (!this.firstMediaChangeIgnored) {
            this.firstMediaChangeIgnored = true;
            this.logger.debug('Ignoring first media change');
            return;
        }

        // End current session and start new one
        if (this.currentSession) {
            await this.endSession();
        }

        await this.startSession(mediaInfo);
    }

    async startSession(mediaInfo) {
        const startTime = Date.now();
        
        // Create new session
        const result = await this.db.run(
            'INSERT INTO video_sessions (media_id, media_title, start_time) VALUES (?, ?, ?)',
            [mediaInfo.id || 'unknown', mediaInfo.title || 'Untitled', startTime]
        );

        this.currentSession = {
            id: result.lastID,
            startTime: startTime,
            mediaInfo: mediaInfo
        };

        // Track all current users
        this.currentWatchers.clear();
        const userlist = this.bot.getUserlist();
        
        for (const [username, userInfo] of userlist) {
            if (!this.isSystemUser(username)) {
                this.currentWatchers.set(username, startTime);
                await this.addWatcher(username, startTime);
            }
        }

        this.logger.info(`Started new video session: ${mediaInfo.title || 'Untitled'} with ${this.currentWatchers.size} watchers`);
    }

    async endSession() {
        if (!this.currentSession) return;

        const endTime = Date.now();
        const duration = endTime - this.currentSession.startTime;
        const halfwayMark = this.currentSession.startTime + (duration / 2);

        // Update session end time and duration
        await this.db.run(
            'UPDATE video_sessions SET end_time = ?, duration = ? WHERE id = ?',
            [endTime, duration, this.currentSession.id]
        );

        // Process rewards for eligible watchers
        let rewardCount = 0;
        let totalPayout = 0;

        for (const [username, joinTime] of this.currentWatchers) {
            // Check if user joined before halfway mark
            if (joinTime <= halfwayMark) {
                const reward = await this.rewardUser(username, this.currentSession.id);
                if (reward > 0) {
                    rewardCount++;
                    totalPayout += reward;
                }
            } else {
                this.logger.debug(`Skipping ${username} - joined after halfway mark`);
            }
        }

        this.logger.info(`Session ended: ${rewardCount} users rewarded, total payout: $${totalPayout}`);
        this.currentSession = null;
        this.currentWatchers.clear();
    }

    async addWatcher(username, joinTime) {
        if (!this.currentSession || this.isSystemUser(username)) return;

        await this.db.run(
            'INSERT INTO video_watchers (session_id, username, join_time) VALUES (?, ?, ?)',
            [this.currentSession.id, username, joinTime]
        );

        this.currentWatchers.set(username, joinTime);
    }

    async removeWatcher(username) {
        if (!this.currentSession || !this.currentWatchers.has(username)) return;

        const leaveTime = Date.now();
        
        await this.db.run(
            'UPDATE video_watchers SET leave_time = ? WHERE session_id = ? AND username = ? AND leave_time IS NULL',
            [leaveTime, this.currentSession.id, username]
        );

        this.currentWatchers.delete(username);
    }

    async rewardUser(username, sessionId) {
        // Determine reward amount
        const isLucky = Math.random() < this.config.LUCKY_CHANCE;
        const rewardAmount = isLucky ? this.config.LUCKY_REWARD : this.config.NORMAL_REWARD;

        // Ensure user exists in economy system
        await this.bot.heistManager.getOrCreateUser(username);
        
        // Update user balance (no trust change for video watching)
        await this.bot.heistManager.updateUserEconomy(username, rewardAmount, 0);

        // Mark as rewarded
        await this.db.run(
            'UPDATE video_watchers SET rewarded = 1, reward_amount = ? WHERE session_id = ? AND username = ?',
            [rewardAmount, sessionId, username]
        );

        this.logger.debug(`Rewarded ${username}: $${rewardAmount}${isLucky ? ' (LUCKY!)' : ''}`);
        return rewardAmount;
    }

    async handleUserJoin(username) {
        if (!this.currentSession || this.isSystemUser(username)) return;

        const joinTime = Date.now();
        const duration = joinTime - this.currentSession.startTime;
        const halfwayMark = this.currentSession.startTime + (duration / 2);

        // Only track if joining before current halfway mark
        if (joinTime <= halfwayMark) {
            await this.addWatcher(username, joinTime);
            this.logger.debug(`${username} joined video session`);
        }
    }

    async handleUserLeave(username) {
        await this.removeWatcher(username);
        this.logger.debug(`${username} left video session`);
    }

    // Get user's video watching stats
    async getUserStats(username) {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as videos_watched,
                SUM(reward_amount) as total_earned,
                COUNT(CASE WHEN reward_amount = ? THEN 1 END) as lucky_rewards
            FROM video_watchers 
            WHERE username = ? AND rewarded = 1
        `, [this.config.LUCKY_REWARD, username]);

        return stats;
    }
    
    // Clean shutdown - preserve state but don't reward yet
    async shutdown() {
        if (this.currentSession) {
            this.logger.info(`Preserving video session state for: ${this.currentSession.mediaInfo.title}`);
            // Don't end the session, just save current state
            // The session will be resumed on next startup
        }
    }
}