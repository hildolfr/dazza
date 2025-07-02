import { createLogger } from '../../utils/logger.js';
import EventEmitter from 'events';
import { contentLoader } from './contentLoader.js';
import { normalizeUsernameForDb, getCanonicalUsername } from '../../utils/usernameNormalizer.js';

/**
 * Room-aware heist economy system
 * Manages criminal activities, voting, and money distribution
 * Heists are global (one at a time) but participation is room-specific
 */
export class HeistManager extends EventEmitter {
    constructor(db, bot) {
        super();
        this.db = db;
        this.bot = bot;
        this.logger = createLogger('HeistManager');
        
        // State machine
        this.states = {
            IDLE: 'IDLE',
            ANNOUNCING: 'ANNOUNCING',
            VOTING: 'VOTING',
            IN_PROGRESS: 'IN_PROGRESS',
            DISTRIBUTING: 'DISTRIBUTING',
            COOLDOWN: 'COOLDOWN'
        };
        
        // Global heist state (prevents simultaneous heists)
        this.currentState = this.states.IDLE;
        this.currentHeistId = null;
        this.currentHeistRoom = null; // Room where current heist started
        this.currentHeistCrimes = []; // Currently offered crimes
        
        // Room-specific tracking
        this.roomStates = new Map(); // roomId -> { activeUsers, messageCount, votes }
        
        // Configuration
        this.config = {
            MIN_WAIT_HOURS: 1,
            MAX_WAIT_HOURS: 10,
            MIN_CRIME_DURATION: 20 * 60 * 1000,
            MAX_CRIME_DURATION: 40 * 60 * 1000,
            VOTING_DURATION: 1 * 60 * 1000,
            MIN_ACTIVE_USERS: 2,
            MIN_MESSAGES: 5,
            ACTIVITY_WINDOW: 60 * 60 * 1000,
            TRUST_VOTE_BONUS: 1,
            TRUST_SUCCESS_BONUS: 2,
            TRUST_FAILURE_PENALTY: -1
        };
        
        // Timers
        this.nextHeistTimer = null;
        this.stateTimer = null;
        this.activityCheckInterval = null;
    }

    async init() {
        try {
            // Load content files
            await contentLoader.loadContent();
            
            // Ensure Dazza exists in the economy system
            await this.getOrCreateUser('dazza');
            this.logger.debug('Dazza initialized in economy system');
            
            // Load saved state
            const savedState = await this.getConfig('heist_state');
            const savedRoom = await this.getConfig('heist_room');
            const nextHeistTime = await this.getConfig('next_heist_time');
            
            if (savedState && savedState !== this.states.IDLE && savedRoom) {
                // Resume interrupted heist
                this.currentHeistRoom = savedRoom;
                await this.resumeInterruptedHeist(savedState);
            } else if (nextHeistTime) {
                // Schedule next heist
                const timeUntil = parseInt(nextHeistTime) - Date.now();
                if (timeUntil > 0) {
                    this.scheduleNextHeist(timeUntil);
                } else {
                    // Missed scheduled time
                    await this.checkAndStartHeist();
                }
            } else {
                // First run
                this.scheduleRandomHeist();
            }
            
            // Start activity tracking
            this.startActivityTracking();
            
            this.logger.info('HeistManager initialized with room support');
        } catch (error) {
            this.logger.error('Failed to initialize HeistManager:', error);
        }
    }

    // Get or create room state
    getRoomState(roomId) {
        if (!this.roomStates.has(roomId)) {
            this.roomStates.set(roomId, {
                activeUsers: new Set(),
                messageCount: 0,
                votes: new Map(),
                lastActivity: Date.now()
            });
        }
        return this.roomStates.get(roomId);
    }

    // Activity tracking with room context
    async trackActivity(username, roomId) {
        // Exclude system users from activity tracking
        if (this.isSystemUser(username)) {
            return;
        }
        
        const roomState = this.getRoomState(roomId);
        roomState.activeUsers.add(username);
        roomState.messageCount++;
        roomState.lastActivity = Date.now();
        
        this.logger.debug(`Activity tracked for ${username} in room ${roomId}`);
    }

    // Modified to track messages per room
    async handleMessage(username, message, roomId) {
        // Track activity
        await this.trackActivity(username, roomId);
        
        // Only process commands from the room where heist is active
        if (this.currentState === this.states.VOTING && roomId === this.currentHeistRoom) {
            await this.checkVote(username, message, roomId);
        }
    }

    // Check activity levels across all rooms
    async checkActivity() {
        const now = Date.now();
        let mostActiveRoom = null;
        let highestActivity = 0;
        
        // Clean up old room states and find most active room
        for (const [roomId, state] of this.roomStates.entries()) {
            // Remove inactive rooms
            if (now - state.lastActivity > this.config.ACTIVITY_WINDOW) {
                this.roomStates.delete(roomId);
                continue;
            }
            
            // Check if this room has enough activity
            if (state.activeUsers.size >= this.config.MIN_ACTIVE_USERS &&
                state.messageCount >= this.config.MIN_MESSAGES) {
                
                const activityScore = state.activeUsers.size + (state.messageCount / 10);
                if (activityScore > highestActivity) {
                    highestActivity = activityScore;
                    mostActiveRoom = roomId;
                }
            }
        }
        
        if (mostActiveRoom) {
            this.logger.info(`Most active room for heist: ${mostActiveRoom} (score: ${highestActivity})`);
            return {
                isActive: true,
                room: mostActiveRoom,
                users: this.roomStates.get(mostActiveRoom).activeUsers.size,
                messages: this.roomStates.get(mostActiveRoom).messageCount
            };
        }
        
        return { isActive: false };
    }

    // Start heist in specific room
    async startHeist(room = null) {
        try {
            this.currentState = this.states.ANNOUNCING;
            await this.setConfig('heist_state', this.currentState);
            
            // If no room specified, find most active
            if (!room) {
                const activity = await this.checkActivity();
                if (!activity.isActive) {
                    this.logger.info('No room has enough activity for heist, rescheduling');
                    this.currentState = this.states.IDLE;
                    await this.setConfig('heist_state', this.currentState);
                    this.scheduleRandomHeist();
                    return;
                }
                room = activity.room;
            }
            
            this.currentHeistRoom = room;
            await this.setConfig('heist_room', room);
            
            // Create heist event
            const result = await this.db.run(
                'INSERT INTO heist_events (status, created_at, room_id) VALUES (?, ?, ?)',
                ['announced', Date.now(), room]
            );
            this.currentHeistId = result.lastID;
            
            // Select crimes
            const selectedCrimes = this.selectRandomCrimes(3);
            this.currentHeistCrimes = selectedCrimes;
            
            // Generate announcement
            const announcement = contentLoader.generateAnnouncement(selectedCrimes);
            
            // Clear room votes for new heist
            const roomState = this.getRoomState(room);
            roomState.votes.clear();
            
            // Emit announcement event with room context
            this.emit('announce', {
                message: announcement,
                crimes: selectedCrimes,
                roomId: room
            });
            
            // Schedule voting end
            this.stateTimer = setTimeout(() => this.endVoting(), this.config.VOTING_DURATION);
            
            // Transition to voting state
            this.currentState = this.states.VOTING;
            await this.setConfig('heist_state', this.currentState);
            
            this.logger.info(`Heist ${this.currentHeistId} announced in room ${room}`);
            
        } catch (error) {
            this.logger.error('Failed to start heist:', error);
            await this.handleError();
        }
    }

    // Modified to only accept votes from the heist room
    async vote(username, crimeType, roomId) {
        if (this.currentState !== this.states.VOTING) {
            return { success: false, message: 'No active heist voting' };
        }
        
        // Only accept votes from the room where heist started
        if (roomId !== this.currentHeistRoom) {
            return { success: false, message: 'Heist not active in this room' };
        }
        
        // Normalize username
        const canonical = getCanonicalUsername(username);
        const roomState = this.getRoomState(roomId);
        
        // Check if user already voted
        if (roomState.votes.has(canonical)) {
            return { success: false, message: 'Already voted' };
        }
        
        // Validate crime type
        if (!this.currentHeistCrimes.includes(crimeType)) {
            return { success: false, message: 'Invalid crime type' };
        }
        
        // Record vote
        roomState.votes.set(canonical, crimeType);
        
        // Get or create user
        await this.getOrCreateUser(canonical);
        
        // Award trust for voting
        await this.modifyUserTrust(canonical, this.config.TRUST_VOTE_BONUS);
        
        // Emit vote registered event with room
        this.emit('vote_registered', {
            username: username,
            crime: crimeType,
            roomId: roomId
        });
        
        this.logger.debug(`Vote registered: ${username} -> ${crimeType} in room ${roomId}`);
        
        return { success: true };
    }

    // Execute heist with participants from specific room
    async executeHeist() {
        try {
            this.currentState = this.states.IN_PROGRESS;
            await this.setConfig('heist_state', this.currentState);
            
            const roomState = this.getRoomState(this.currentHeistRoom);
            const votes = roomState.votes;
            
            // Tally votes
            const voteCounts = new Map();
            for (const crime of votes.values()) {
                voteCounts.set(crime, (voteCounts.get(crime) || 0) + 1);
            }
            
            // Determine winning crime
            let winningCrime = null;
            let maxVotes = 0;
            for (const [crime, count] of voteCounts) {
                if (count > maxVotes) {
                    maxVotes = count;
                    winningCrime = crime;
                }
            }
            
            // If no votes, pick random crime
            if (!winningCrime) {
                winningCrime = this.currentHeistCrimes[Math.floor(Math.random() * this.currentHeistCrimes.length)];
            }
            
            // Get crime data
            const crimeData = contentLoader.crimes.find(c => c.type === winningCrime);
            
            // Record participants - only from the heist room
            const participants = Array.from(votes.keys());
            for (const username of participants) {
                await this.db.run(
                    'INSERT INTO heist_participants (heist_id, username, crime_voted) VALUES (?, ?, ?)',
                    [this.currentHeistId, username, votes.get(username)]
                );
            }
            
            // Update heist record
            await this.db.run(
                'UPDATE heist_events SET status = ?, crime_type = ?, participant_count = ? WHERE id = ?',
                ['in_progress', winningCrime, participants.length, this.currentHeistId]
            );
            
            // Generate and emit departure message with room context
            const departureMsg = contentLoader.generateDeparture(crimeData, participants);
            this.emit('depart', {
                message: departureMsg,
                crime: crimeData,
                participants: participants.length,
                roomId: this.currentHeistRoom
            });
            
            // Calculate crime duration
            const duration = this.config.MIN_CRIME_DURATION + 
                Math.random() * (this.config.MAX_CRIME_DURATION - this.config.MIN_CRIME_DURATION);
            
            // Schedule heist completion
            this.stateTimer = setTimeout(() => this.completeHeist(), duration);
            
            this.logger.info(`Heist ${this.currentHeistId} executing ${winningCrime} with ${participants.length} participants from room ${this.currentHeistRoom}`);
            
        } catch (error) {
            this.logger.error('Failed to execute heist:', error);
            await this.handleError();
        }
    }

    // Complete heist and distribute rewards to room participants
    async completeHeist() {
        try {
            this.currentState = this.states.DISTRIBUTING;
            await this.setConfig('heist_state', this.currentState);
            
            // Get heist data
            const heist = await this.db.get(
                'SELECT * FROM heist_events WHERE id = ?',
                [this.currentHeistId]
            );
            
            const crimeData = contentLoader.crimes.find(c => c.type === heist.crime_type);
            
            // Determine success
            const successRoll = Math.random();
            const success = successRoll < crimeData.success_rate;
            
            // Calculate total haul
            let totalHaul = 0;
            if (success) {
                const baseAmount = crimeData.min_payout + 
                    Math.random() * (crimeData.max_payout - crimeData.min_payout);
                totalHaul = Math.floor(baseAmount * heist.participant_count);
            }
            
            // Update heist record
            await this.db.run(
                'UPDATE heist_events SET status = ?, success = ?, total_payout = ?, completed_at = ? WHERE id = ?',
                ['completed', success ? 1 : 0, totalHaul, Date.now(), this.currentHeistId]
            );
            
            // Generate return message
            const returnMsg = contentLoader.generateReturn(crimeData, heist.participant_count, success, totalHaul);
            
            // Emit return event with room context
            this.emit('return', {
                message: returnMsg,
                success: success,
                totalHaul: totalHaul,
                roomId: this.currentHeistRoom
            });
            
            // Distribute money to participants from the heist room
            if (totalHaul > 0) {
                await this.distributeMoney(totalHaul, success);
            }
            
            // Transition to cooldown
            this.currentState = this.states.COOLDOWN;
            await this.setConfig('heist_state', this.currentState);
            
            // Clear heist room
            this.currentHeistRoom = null;
            await this.setConfig('heist_room', null);
            
            // Schedule next heist
            this.scheduleRandomHeist();
            
            this.logger.info(`Heist ${this.currentHeistId} completed: ${success ? 'SUCCESS' : 'FAILURE'}, $${totalHaul} distributed`);
            
        } catch (error) {
            this.logger.error('Failed to complete heist:', error);
            await this.handleError();
        }
    }

    // Distribute money only to participants from the heist room
    async distributeMoney(totalHaul, success) {
        try {
            // Get participants
            const participants = await this.db.all(
                'SELECT username, crime_voted FROM heist_participants WHERE heist_id = ?',
                [this.currentHeistId]
            );
            
            if (participants.length === 0) return;
            
            // Calculate individual shares
            const sharePerPerson = Math.floor(totalHaul / participants.length);
            
            const payouts = [];
            
            for (const participant of participants) {
                const username = participant.username;
                
                // Update balance
                await this.modifyUserBalance(username, sharePerPerson);
                
                // Update trust
                const trustChange = success ? 
                    this.config.TRUST_SUCCESS_BONUS : 
                    this.config.TRUST_FAILURE_PENALTY;
                await this.modifyUserTrust(username, trustChange);
                
                // Record payout
                await this.db.run(
                    'INSERT INTO heist_payouts (heist_id, username, amount, created_at) VALUES (?, ?, ?, ?)',
                    [this.currentHeistId, username, sharePerPerson, Date.now()]
                );
                
                payouts.push({
                    username: username,
                    amount: sharePerPerson
                });
            }
            
            // Emit payout event with room context
            this.emit('payout', {
                payouts: payouts,
                roomId: this.currentHeistRoom
            });
            
            this.logger.debug(`Distributed $${totalHaul} to ${participants.length} participants`);
            
        } catch (error) {
            this.logger.error('Failed to distribute money:', error);
        }
    }

    // Helper to check if user is a system user
    isSystemUser(username) {
        const systemUsers = ['cytube', 'system', '[server]', '[anonymous]'];
        return systemUsers.includes(username.toLowerCase());
    }

    // Database helper methods
    async getOrCreateUser(username) {
        // Don't create economy entries for system users
        if (this.isSystemUser(username)) {
            this.logger.warn(`Attempted to create economy entry for system user: ${username}`);
            return { username, balance: 0, trust: 0, trust_score: 0 };
        }
        
        const normalizedUsername = normalizeUsernameForDb(username);
        
        let user = await this.db.get(
            'SELECT * FROM user_economy WHERE username = ?',
            [normalizedUsername]
        );
        
        if (!user) {
            // Check if trust_score column exists
            const tableInfo = await this.db.all(`PRAGMA table_info(user_economy)`);
            const hasTrustScore = tableInfo.some(col => col.name === 'trust_score');
            
            if (hasTrustScore) {
                await this.db.run(
                    'INSERT OR IGNORE INTO user_economy (username, balance, trust_score) VALUES (?, 0, 50)',
                    [normalizedUsername]
                );
            } else {
                await this.db.run(
                    'INSERT OR IGNORE INTO user_economy (username, balance) VALUES (?, 0)',
                    [normalizedUsername]
                );
            }
            
            // Fetch the user after creation
            user = await this.db.get(
                'SELECT * FROM user_economy WHERE username = ?',
                [normalizedUsername]
            );
        }
        
        return user || { username: normalizedUsername, balance: 0, trust: 50, trust_score: 50 };
    }

    async modifyUserBalance(username, amount) {
        const normalizedUsername = normalizeUsernameForDb(username);
        
        await this.db.run(
            'UPDATE user_economy SET balance = balance + ? WHERE username = ?',
            [amount, normalizedUsername]
        );
    }
    
    // Compatibility method for commands that use the old signature
    async updateUserEconomy(username, amount, trustChange = 0) {
        await this.modifyUserBalance(username, amount);
        if (trustChange !== 0) {
            await this.modifyUserTrust(username, trustChange);
        }
    }

    async modifyUserTrust(username, amount) {
        const normalizedUsername = normalizeUsernameForDb(username);
        
        // Check if trust_score column exists
        const tableInfo = await this.db.all(`PRAGMA table_info(user_economy)`);
        const hasTrustScore = tableInfo.some(col => col.name === 'trust_score');
        
        if (hasTrustScore) {
            await this.db.run(
                'UPDATE user_economy SET trust_score = MAX(0, MIN(100, trust_score + ?)) WHERE username = ?',
                [amount, normalizedUsername]
            );
        } else {
            // Column doesn't exist yet, skip the update
            this.logger.debug('trust_score column not yet available, skipping trust update');
        }
    }

    getTrustLevel(trust) {
        if (trust >= 90) return { title: "Made Man", icon: "👑" };
        if (trust >= 75) return { title: "Career Criminal", icon: "💀" };
        if (trust >= 60) return { title: "Seasoned Crim", icon: "🔫" };
        if (trust >= 40) return { title: "Petty Crim", icon: "🔪" };
        if (trust >= 20) return { title: "Snitch Risk", icon: "🐀" };
        return { title: "Rat", icon: "🐁" };
    }

    async getUserBalance(username) {
        const normalizedUsername = normalizeUsernameForDb(username);
        
        // Get user data from database
        const user = await this.db.get(
            'SELECT balance, COALESCE(trust_score, trust, 50) as trust FROM user_economy WHERE username = ?',
            [normalizedUsername]
        );
        
        if (!user) {
            // Create user if they don't exist
            await this.getOrCreateUser(username);
            return {
                balance: 0,
                trust: 50,
                trustLevel: this.getTrustLevel(50)
            };
        }
        
        return {
            balance: user.balance || 0,
            trust: user.trust || 50,
            trustLevel: this.getTrustLevel(user.trust || 50)
        };
    }

    // Config management
    async getConfig(key) {
        const result = await this.db.get(
            'SELECT value FROM heist_config WHERE key = ?',
            [key]
        );
        return result ? result.value : null;
    }

    async setConfig(key, value) {
        await this.db.run(
            'INSERT OR REPLACE INTO heist_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [key, value]
        );
    }

    // Crime selection
    selectRandomCrimes(count = 3) {
        const availableCrimes = [...contentLoader.crimes];
        const selected = [];
        
        for (let i = 0; i < Math.min(count, availableCrimes.length); i++) {
            const index = Math.floor(Math.random() * availableCrimes.length);
            selected.push(availableCrimes[index].type);
            availableCrimes.splice(index, 1);
        }
        
        return selected;
    }

    // Scheduling
    scheduleRandomHeist() {
        const waitHours = this.config.MIN_WAIT_HOURS + 
            Math.random() * (this.config.MAX_WAIT_HOURS - this.config.MIN_WAIT_HOURS);
        const waitTime = waitHours * 60 * 60 * 1000;
        
        this.scheduleNextHeist(waitTime);
        
        this.logger.info(`Next heist scheduled in ${waitHours.toFixed(1)} hours`);
    }

    scheduleNextHeist(waitTime) {
        if (this.nextHeistTimer) {
            clearTimeout(this.nextHeistTimer);
        }
        
        const nextTime = Date.now() + waitTime;
        this.setConfig('next_heist_time', nextTime.toString());
        
        this.nextHeistTimer = setTimeout(() => {
            this.checkAndStartHeist();
        }, waitTime);
    }

    async checkAndStartHeist() {
        if (this.currentState !== this.states.IDLE && this.currentState !== this.states.COOLDOWN) {
            this.logger.warn('Cannot start heist - one already in progress');
            return;
        }
        
        this.currentState = this.states.IDLE;
        await this.setConfig('heist_state', this.currentState);
        
        await this.startHeist();
    }

    // Activity tracking
    startActivityTracking() {
        // Clean up room states periodically
        this.activityCheckInterval = setInterval(() => {
            const now = Date.now();
            for (const [roomId, state] of this.roomStates.entries()) {
                if (now - state.lastActivity > this.config.ACTIVITY_WINDOW) {
                    this.roomStates.delete(roomId);
                    this.logger.debug(`Cleaned up inactive room state: ${roomId}`);
                }
            }
        }, 60000); // Check every minute
    }

    // Cleanup
    stop() {
        if (this.nextHeistTimer) {
            clearTimeout(this.nextHeistTimer);
        }
        if (this.stateTimer) {
            clearTimeout(this.stateTimer);
        }
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
        }
    }

    // Error handling
    async handleError() {
        this.logger.error('Heist error - resetting to idle state');
        this.currentState = this.states.IDLE;
        this.currentHeistRoom = null;
        await this.setConfig('heist_state', this.currentState);
        await this.setConfig('heist_room', null);
        this.scheduleRandomHeist();
    }

    // Resume interrupted heist
    async resumeInterruptedHeist(savedState) {
        this.logger.info(`Resuming heist in state: ${savedState}, room: ${this.currentHeistRoom}`);
        
        this.currentState = savedState;
        
        // Get the last heist
        const lastHeist = await this.db.get(
            'SELECT * FROM heist_events WHERE room_id = ? ORDER BY id DESC LIMIT 1',
            [this.currentHeistRoom]
        );
        
        if (!lastHeist) {
            await this.handleError();
            return;
        }
        
        this.currentHeistId = lastHeist.id;
        
        // Resume based on state
        switch (savedState) {
            case this.states.VOTING:
                // Resume voting with short timer
                this.emit('resume_voting', {
                    roomId: this.currentHeistRoom
                });
                this.stateTimer = setTimeout(() => this.endVoting(), 30000); // 30 seconds to finish voting
                break;
                
            case this.states.IN_PROGRESS:
                // Resume heist in progress
                this.emit('resume_progress', {
                    roomId: this.currentHeistRoom
                });
                this.stateTimer = setTimeout(() => this.completeHeist(), 60000); // Complete in 1 minute
                break;
                
            default:
                await this.handleError();
        }
    }

    // Check if a message contains a vote
    async checkVote(username, message, roomId) {
        if (this.currentState !== this.states.VOTING || roomId !== this.currentHeistRoom) {
            return;
        }
        
        const lowerMessage = message.toLowerCase().trim();
        
        // First check for exact single-word match
        if (this.currentHeistCrimes.includes(lowerMessage)) {
            await this.vote(username, lowerMessage, roomId);
            return;
        }
        
        // Check for crime matches using word boundaries
        for (const crime of this.currentHeistCrimes) {
            // Create regex to match the crime as a whole word
            const crimeRegex = new RegExp(`\\b${crime}\\b`, 'i');
            
            if (crimeRegex.test(message)) {
                await this.vote(username, crime, roomId);
                return;
            }
            
            // Also check if they typed the full crime name
            const crimeData = contentLoader.crimes.find(c => c.type === crime);
            if (crimeData) {
                // Check for the crime name (e.g., "rob servo")
                if (message.toLowerCase().includes(crimeData.name.toLowerCase())) {
                    await this.vote(username, crime, roomId);
                    return;
                }
                
                // Check for any aliases
                if (crimeData.aliases) {
                    for (const alias of crimeData.aliases) {
                        const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
                        if (aliasRegex.test(message)) {
                            await this.vote(username, crime, roomId);
                            return;
                        }
                    }
                }
            }
        }
    }
    
    // End voting phase
    async endVoting() {
        if (this.currentState !== this.states.VOTING) return;
        
        const roomState = this.getRoomState(this.currentHeistRoom);
        
        if (roomState.votes.size === 0) {
            // No votes received
            this.emit('comment', {
                message: contentLoader.getRandomComment('no_votes'),
                roomId: this.currentHeistRoom
            });
            
            // Cancel heist
            await this.db.run(
                'UPDATE heist_events SET status = ? WHERE id = ?',
                ['cancelled', this.currentHeistId]
            );
            
            this.currentState = this.states.IDLE;
            this.currentHeistRoom = null;
            await this.setConfig('heist_state', this.currentState);
            await this.setConfig('heist_room', null);
            this.scheduleRandomHeist();
        } else {
            // Proceed with heist
            await this.executeHeist();
        }
    }
}

// Export the class
export default HeistManager;