import { createLogger } from '../../utils/logger.js';
import EventEmitter from 'events';
import { contentLoader } from './contentLoader.js';
import { normalizeUsernameForDb, getCanonicalUsername } from '../../utils/usernameNormalizer.js';

/**
 * Self-contained heist economy system
 * Manages criminal activities, voting, and money distribution
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
        
        this.currentState = this.states.IDLE;
        this.currentHeistId = null;
        this.currentHeistCrimes = []; // Currently offered crimes
        this.votes = new Map(); // username -> crime_type
        this.activeUsers = new Set();
        this.messageCount = 0;
        
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
            const nextHeistTime = await this.getConfig('next_heist_time');
            
            if (savedState && savedState !== this.states.IDLE) {
                // Resume interrupted heist
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
            
            this.logger.info('HeistManager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize HeistManager:', error);
        }
    }

    // Activity tracking
    async trackActivity(username) {
        // Exclude system users from activity tracking
        if (this.isSystemUser(username)) {
            return;
        }
        this.activeUsers.add(username);
        this.messageCount++;
    }

    async checkActivity() {
        const hasEnoughUsers = this.activeUsers.size >= this.config.MIN_ACTIVE_USERS;
        const hasEnoughMessages = this.messageCount >= this.config.MIN_MESSAGES;
        
        if (!hasEnoughUsers || !hasEnoughMessages) {
            this.logger.debug(`Activity check failed: ${this.activeUsers.size} users, ${this.messageCount} messages`);
            return false;
        }
        
        return true;
    }

    startActivityTracking() {
        // Reset activity every hour
        this.activityCheckInterval = setInterval(() => {
            this.activeUsers.clear();
            this.messageCount = 0;
        }, this.config.ACTIVITY_WINDOW);
    }

    // State management
    async setState(newState, timerEndTime = null) {
        this.currentState = newState;
        await this.setConfig('heist_state', newState);
        
        // Save timer end time if provided
        if (timerEndTime) {
            await this.setConfig('state_timer_end', timerEndTime);
        } else {
            // Clear timer end time when no timer is active
            await this.db.run('DELETE FROM heist_config WHERE key = ?', ['state_timer_end']);
        }
        
        this.logger.debug(`State changed to: ${newState}`);
    }

    // Heist scheduling
    scheduleRandomHeist() {
        const hours = Math.random() * (this.config.MAX_WAIT_HOURS - this.config.MIN_WAIT_HOURS) + this.config.MIN_WAIT_HOURS;
        const ms = hours * 60 * 60 * 1000;
        this.scheduleNextHeist(ms);
    }

    scheduleNextHeist(ms) {
        const nextTime = Date.now() + ms;
        this.setConfig('next_heist_time', nextTime);
        
        this.nextHeistTimer = setTimeout(() => {
            this.checkAndStartHeist();
        }, Math.min(ms, 2147483647));
        
        const hours = Math.round(ms / (60 * 60 * 1000));
        this.logger.info(`Next heist scheduled in ${hours} hours`);
    }

    async checkAndStartHeist() {
        const isActive = await this.checkActivity();
        if (!isActive) {
            this.logger.debug('Channel not active enough, rescheduling heist');
            this.scheduleRandomHeist();
            return;
        }
        
        await this.startHeist();
    }

    // Main heist flow
    async startHeist() {
        try {
            await this.setState(this.states.ANNOUNCING);
            
            // Create heist record
            const heistId = await this.createHeistEvent();
            this.currentHeistId = heistId;
            
            // Get all available crimes and pick 2 random ones
            const allCrimes = contentLoader.getCrimes();
            const selectedCrimes = this.selectRandomCrimes(allCrimes, 2);
            
            // Store selected crimes for this heist
            this.currentHeistCrimes = selectedCrimes;
            
            // Save crimes for recovery
            await this.setConfig('current_crimes', JSON.stringify(selectedCrimes));
            
            // Create crime list for announcement with bracketed trigger words
            const crimeList = selectedCrimes
                .map(c => `${c.name} [${c.id}]`)
                .join(' or ');
            
            // Get announcement based on time of day
            const context = contentLoader.getTimeContext();
            let announcement = contentLoader.getAnnouncement(context);
            
            // Replace {crimes} placeholder
            announcement = announcement.replace('{crimes}', crimeList);
            
            this.emit('announce', {
                message: announcement,
                crimes: selectedCrimes
            });
            
            // Start voting phase
            const votingEndTime = Date.now() + this.config.VOTING_DURATION;
            await this.setState(this.states.VOTING, votingEndTime);
            this.votes.clear();
            
            this.stateTimer = setTimeout(() => {
                // Validate we're still in the expected state
                if (this.currentState === this.states.VOTING) {
                    this.executeHeist();
                } else {
                    this.logger.warn('Voting timer fired but state is no longer VOTING');
                }
            }, this.config.VOTING_DURATION);
            
        } catch (error) {
            this.logger.error('Failed to start heist:', error);
            await this.cleanupHeistState();
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
        }
    }
    
    // Helper to select random crimes
    selectRandomCrimes(crimes, count) {
        const shuffled = [...crimes].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    async vote(username, crimeType) {
        if (this.currentState !== this.states.VOTING) {
            return false;
        }
        
        // Exclude system users from voting
        if (this.isSystemUser(username)) {
            return false;
        }
        
        this.votes.set(username, crimeType);
        await this.recordParticipant(this.currentHeistId, username, crimeType);
        return true;
    }

    async executeHeist() {
        try {
            // Clear voting timer end time
            await this.setState(this.states.IN_PROGRESS);
            
            // Determine which crime won
            const selectedCrime = await this.selectCrime();
            await this.updateHeistCrime(this.currentHeistId, selectedCrime.id);
            
            // Announce departure
            let departureContext = 'standard';
            if (this.votes.size === 0) {
                departureContext = 'solo'; // Dazza going alone - lazy cunts!
            } else if (this.votes.size > 5) {
                departureContext = 'with_mates';
            } else if (Math.random() < 0.2) {
                departureContext = 'nervous';
            } else if (Math.random() < 0.2) {
                departureContext = 'confident';
            } else if (Math.random() < 0.1) {
                departureContext = 'rushed';
            }
            
            let departure = contentLoader.getDeparture(departureContext);
            departure = departure.replace('{crime}', selectedCrime.name);
            
            this.emit('depart', {
                message: departure,
                crime: selectedCrime
            });
            
            // Calculate duration
            const duration = Math.random() * 
                (this.config.MAX_CRIME_DURATION - this.config.MIN_CRIME_DURATION) + 
                this.config.MIN_CRIME_DURATION;
            
            // Save crime completion time
            const crimeEndTime = Date.now() + duration;
            await this.setConfig('state_timer_end', crimeEndTime);
            await this.setConfig('current_crime_id', selectedCrime.id);
            
            this.stateTimer = setTimeout(() => {
                // Validate we're still in the expected state
                if (this.currentState === this.states.IN_PROGRESS) {
                    this.completeHeist(selectedCrime);
                } else {
                    this.logger.warn('Heist timer fired but state is no longer IN_PROGRESS');
                }
            }, duration);
            
        } catch (error) {
            this.logger.error('Failed to execute heist:', error);
            await this.cleanupHeistState();
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
        }
    }

    async completeHeist(crime) {
        try {
            await this.setState(this.states.DISTRIBUTING);
            
            // Determine success
            const success = Math.random() < crime.success_rate;
            const haul = success ? 
                Math.floor(Math.random() * (crime.max_payout - crime.min_payout) + crime.min_payout) :
                0;
            
            await this.updateHeistResult(this.currentHeistId, success, haul);
            
            // Get outcome message from content loader
            const isSolo = this.votes.size === 0;
            const outcomeMessage = contentLoader.getOutcome(success, haul, crime, isSolo);
            
            this.emit('return', {
                message: outcomeMessage,
                success: success,
                haul: haul
            });
            
            // Distribute money
            await this.distributeMoney(haul, success);
            
            // Cooldown
            const cooldownEndTime = Date.now() + 60000; // 1 minute cooldown
            await this.setState(this.states.COOLDOWN, cooldownEndTime);
            
            // Clean up saved heist data since it's complete
            await this.db.run('DELETE FROM heist_config WHERE key IN (?, ?, ?)', 
                ['current_heist_id', 'current_crimes', 'current_crime_id']);
            
            this.stateTimer = setTimeout(async () => {
                await this.setState(this.states.IDLE);
                this.scheduleRandomHeist();
            }, 60000);
            
        } catch (error) {
            this.logger.error('Failed to complete heist:', error);
            await this.cleanupHeistState();
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
        }
    }

    async distributeMoney(totalHaul, success) {
        // Filter out system users from voters and active users
        const voters = Array.from(this.votes.keys()).filter(u => !this.isSystemUser(u));
        const activeUsers = Array.from(this.activeUsers).filter(u => !this.isSystemUser(u));
        
        // Check who's online from the bot's userlist
        const onlineUsers = new Set();
        if (this.bot && this.bot.userlist) {
            for (const [username, userData] of this.bot.userlist) {
                onlineUsers.add(username.toLowerCase());
            }
        }
        
        const distributions = [];
        
        // Handle Dazza's cut
        let dazzaCut = 0;
        let remainingHaul = totalHaul;
        
        if (success && totalHaul > 0) {
            // Ensure Dazza exists in the economy
            await this.getOrCreateUser('dazza');
            
            if (this.votes.size === 0) {
                // Solo heist - Dazza gets everything!
                dazzaCut = totalHaul;
                remainingHaul = 0;
                
                distributions.push({
                    username: 'dazza',
                    amount: dazzaCut,
                    trustGained: this.config.TRUST_SUCCESS_BONUS + 2, // Extra trust for going solo
                    type: 'solo'
                });
            } else {
                // Regular heist - Dazza gets 10% organizer fee
                dazzaCut = Math.floor(totalHaul * 0.1);
                remainingHaul = totalHaul - dazzaCut;
                
                distributions.push({
                    username: 'dazza',
                    amount: dazzaCut,
                    trustGained: this.config.TRUST_SUCCESS_BONUS,
                    type: 'organizer'
                });
            }
        } else if (!success && this.votes.size === 0) {
            // Failed solo heist - Dazza still gets trust penalty
            await this.getOrCreateUser('dazza');
            distributions.push({
                username: 'dazza',
                amount: 0,
                trustGained: this.config.TRUST_FAILURE_PENALTY,
                type: 'solo'
            });
        }
        
        // Calculate shares from remaining haul
        const voterShare = success ? Math.floor(remainingHaul * 0.3) : 0;
        const activeShare = success ? Math.floor(remainingHaul * 0.7) : 0;
        
        // Prepare distributions first
        let savedFromOfflineUsers = 0;
        
        for (const voter of voters) {
            const user = await this.getOrCreateUser(voter);
            const trustBonus = Math.floor(user.trust / 50) * 0.1; // 10% per 50 trust
            let amount = Math.floor((voterShare / voters.length) * (1 + trustBonus));
            
            // Apply penalty if user is offline
            const isOnline = onlineUsers.has(voter.toLowerCase());
            if (!isOnline && amount > 0) {
                const penalty = Math.floor(amount * 0.5); // 50% penalty for offline voters
                savedFromOfflineUsers += penalty;
                amount = amount - penalty;
            }
            
            const trustGained = success ? 
                this.config.TRUST_VOTE_BONUS + this.config.TRUST_SUCCESS_BONUS :
                this.config.TRUST_VOTE_BONUS + this.config.TRUST_FAILURE_PENALTY;
            
            distributions.push({
                username: voter,
                amount: amount,
                trustGained: trustGained,
                type: 'voter',
                offline: !isOnline
            });
        }
        
        // Distribute to active non-voters (only if there's money left to distribute)
        if (remainingHaul > 0) {
            const nonVoters = activeUsers.filter(u => !voters.includes(u));
            for (const user of nonVoters) {
                const userData = await this.getOrCreateUser(user);
                const trustBonus = Math.floor(userData.trust / 50) * 0.1;
                let amount = Math.floor((activeShare / activeUsers.length) * (1 + trustBonus));
                
                // Apply penalty if user is offline
                const isOnline = onlineUsers.has(user.toLowerCase());
                if (!isOnline && amount > 0) {
                    const penalty = Math.floor(amount * 0.75); // 75% penalty for offline active users
                    savedFromOfflineUsers += penalty;
                    amount = amount - penalty;
                }
                
                distributions.push({
                    username: user,
                    amount: amount,
                    trustGained: 0,
                    type: 'active',
                    offline: !isOnline
                });
            }
        }
        
        // Give saved money back to Dazza
        if (savedFromOfflineUsers > 0) {
            // Find Dazza's distribution and add the saved money
            const dazzaDist = distributions.find(d => d.username === 'dazza');
            if (dazzaDist) {
                dazzaDist.amount += savedFromOfflineUsers;
                dazzaDist.savedFromOffline = savedFromOfflineUsers;
            } else {
                // If Dazza wasn't in distributions yet, add him
                distributions.push({
                    username: 'dazza',
                    amount: savedFromOfflineUsers,
                    trustGained: 0,
                    type: 'saved',
                    savedFromOffline: savedFromOfflineUsers
                });
            }
        }
        
        // Apply distributions in a transaction
        try {
            await this.db.run('BEGIN TRANSACTION');
            
            for (const dist of distributions) {
                // Ensure balance won't go negative
                await this.db.run(`
                    UPDATE user_economy 
                    SET balance = MAX(0, balance + ?), 
                        trust = MAX(0, trust + ?),
                        total_earned = total_earned + ?,
                        heists_participated = heists_participated + 1,
                        updated_at = ?
                    WHERE username = ?
                `, [dist.amount, dist.trustGained, Math.max(0, dist.amount), Date.now(), dist.username]);
                
                await this.db.run(`
                    INSERT INTO economy_transactions 
                    (username, amount, trust_change, transaction_type, heist_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [dist.username, dist.amount, dist.trustGained, 'heist', this.currentHeistId, Date.now()]);
            }
            
            await this.db.run('COMMIT');
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
        
        // Announce distributions
        if (distributions.some(d => d.amount > 0)) {
            const totalPayout = distributions.reduce((sum, d) => sum + d.amount, 0);
            const isSolo = this.votes.size === 0 && success;
            const formattedDist = contentLoader.formatDistributions(distributions);
            let payoutMessage = contentLoader.getPayoutMessage(distributions, totalPayout, isSolo);
            
            // Replace placeholder
            payoutMessage = payoutMessage.replace('{distributions}', formattedDist);
            
            this.emit('payout', {
                message: payoutMessage,
                distributions: distributions
            });
            
            // Sometimes add individual comments
            const topEarner = distributions
                .filter(d => d.amount > 0)
                .sort((a, b) => b.amount - a.amount)[0];
                
            if (topEarner && Math.random() < 0.3) {
                let comment;
                if (topEarner.username === 'dazza' && isSolo) {
                    // Special comment for Dazza going solo
                    comment = contentLoader.getPayoutComment('dazza', topEarner.amount, 100);
                } else if (topEarner.username === 'dazza') {
                    // Pass savedFromOffline for Dazza
                    comment = contentLoader.getPayoutComment(
                        'dazza', 
                        topEarner.amount, 
                        topEarner.trustGained || 0,
                        topEarner.savedFromOffline || 0
                    );
                } else {
                    comment = contentLoader.getPayoutComment(
                        topEarner.username, 
                        topEarner.amount, 
                        topEarner.type === 'voter' ? topEarner.trustGained : 0
                    );
                }
                if (comment) {
                    setTimeout(() => {
                        this.emit('comment', { message: comment });
                    }, 2000);
                }
            }
        }
    }

    async selectCrime() {
        if (this.votes.size === 0) {
            // No votes, pick random from the 2 offered
            return this.currentHeistCrimes[Math.floor(Math.random() * this.currentHeistCrimes.length)];
        }
        
        // Count votes
        const voteCounts = new Map();
        for (const [user, crime] of this.votes) {
            voteCounts.set(crime, (voteCounts.get(crime) || 0) + 1);
        }
        
        // Find winner
        let maxVotes = 0;
        let winners = [];
        for (const [crime, count] of voteCounts) {
            if (count > maxVotes) {
                maxVotes = count;
                winners = [crime];
            } else if (count === maxVotes) {
                winners.push(crime);
            }
        }
        
        // If tie, pick random from winners
        let winner = winners.length === 1 ? winners[0] : 
                     winners[Math.floor(Math.random() * winners.length)];
        
        // Return the winning crime from offered options
        return this.currentHeistCrimes.find(c => c.id === winner) || this.currentHeistCrimes[0];
    }

    // Database operations
    async getConfig(key) {
        const row = await this.db.get('SELECT value FROM heist_config WHERE key = ?', [key]);
        return row ? row.value : null;
    }

    async setConfig(key, value) {
        await this.db.run(
            'INSERT OR REPLACE INTO heist_config (key, value, updated_at) VALUES (?, ?, ?)',
            [key, value.toString(), Date.now()]
        );
    }

    async createHeistEvent() {
        const result = await this.db.run(
            'INSERT INTO heist_events (state, created_at, announced_at) VALUES (?, ?, ?)',
            [this.states.ANNOUNCING, Date.now(), Date.now()]
        );
        
        // Save current heist ID for recovery
        await this.setConfig('current_heist_id', result.lastID);
        
        return result.lastID;
    }

    async updateHeistCrime(heistId, crimeType) {
        await this.db.run(
            'UPDATE heist_events SET crime_type = ?, departed_at = ? WHERE id = ?',
            [crimeType, Date.now(), heistId]
        );
    }

    async updateHeistResult(heistId, success, haul) {
        await this.db.run(
            'UPDATE heist_events SET success = ?, total_haul = ?, returned_at = ?, state = ? WHERE id = ?',
            [success ? 1 : 0, haul, Date.now(), this.states.DISTRIBUTING, heistId]
        );
    }

    async recordParticipant(heistId, username, vote) {
        const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
        await this.db.run(
            'INSERT OR REPLACE INTO heist_participants (heist_id, username, vote, participated_at) VALUES (?, ?, ?, ?)',
            [heistId, canonicalUsername, vote, Date.now()]
        );
    }

    async getOrCreateUser(username) {
        try {
            // Don't create economy entries for system users
            if (this.isSystemUser(username)) {
                this.logger.warn(`Attempted to create economy entry for system user: ${username}`);
                return { username, balance: 0, trust: 0, total_earned: 0, total_lost: 0 };
            }
            
            // Normalize username to canonical form
            const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
            
            // Use INSERT OR IGNORE to handle race conditions
            await this.db.run(
                'INSERT OR IGNORE INTO user_economy (username, balance, trust, created_at, updated_at) VALUES (?, 0, 0, ?, ?)',
                [canonicalUsername, Date.now(), Date.now()]
            );
            
            // Now safely get the user
            const user = await this.db.get('SELECT * FROM user_economy WHERE LOWER(username) = LOWER(?)', [canonicalUsername]);
            return user || { username: canonicalUsername, balance: 0, trust: 0, total_earned: 0, total_lost: 0 };
        } catch (error) {
            this.logger.error('Failed to get/create user:', error);
            // Return a default user object to prevent crashes
            return { username, balance: 0, trust: 0, total_earned: 0, total_lost: 0 };
        }
    }

    async updateUserEconomy(username, amount, trustChange) {
        const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
        try {
            // First check if the update would result in negative balance
            if (amount < 0) {
                const user = await this.db.get('SELECT balance FROM user_economy WHERE LOWER(username) = LOWER(?)', [canonicalUsername]);
                if (user && user.balance + amount < 0) {
                    this.logger.warn(`Prevented negative balance for ${username}: current=${user.balance}, attempted change=${amount}`);
                    // Update to set balance to 0 instead
                    await this.db.run(`
                        UPDATE user_economy 
                        SET balance = 0, 
                            trust = trust + ?,
                            total_lost = total_lost + ?,
                            updated_at = ?
                        WHERE LOWER(username) = LOWER(?)
                    `, [trustChange, Math.abs(user.balance), Date.now(), canonicalUsername]);
                    return;
                }
            }
            
            await this.db.run(`
                UPDATE user_economy 
                SET balance = balance + ?, 
                    trust = trust + ?,
                    total_earned = total_earned + ?,
                    heists_participated = heists_participated + 1,
                    updated_at = ?
                WHERE LOWER(username) = LOWER(?)
            `, [amount, trustChange, Math.max(0, amount), Date.now(), canonicalUsername]);
        } catch (error) {
            if (error.message && error.message.includes('CHECK constraint failed')) {
                this.logger.error(`Balance constraint violation for ${username}: amount=${amount}`);
                // Set balance to 0 if constraint fails
                await this.db.run(`
                    UPDATE user_economy 
                    SET balance = 0, 
                        updated_at = ?
                    WHERE LOWER(username) = LOWER(?)
                `, [Date.now(), canonicalUsername]);
            } else {
                throw error;
            }
        }
    }

    async recordTransaction(username, amount, trustChange, type, heistId) {
        const canonicalUsername = await normalizeUsernameForDb(this.bot, username);
        await this.db.run(`
            INSERT INTO economy_transactions 
            (username, amount, trust_change, transaction_type, heist_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [canonicalUsername, amount, trustChange, type, heistId, Date.now()]);
    }

    async getAvailableCrimes() {
        // This method is no longer used, crimes come from content files
        return contentLoader.getCrimes();
    }

    async getUserBalance(username) {
        const canonicalUsername = await getCanonicalUsername(this.bot, username);
        const user = await this.getOrCreateUser(canonicalUsername);
        return {
            balance: user.balance,
            trust: user.trust,
            trustLevel: this.getTrustLevel(user.trust)
        };
    }

    getTrustLevel(trust) {
        if (trust >= 100) return { title: "Criminal Legend", multiplier: 1.5 };
        if (trust >= 50) return { title: "Dazza's Crew", multiplier: 1.3 };
        if (trust >= 25) return { title: "Trusted Crim", multiplier: 1.2 };
        if (trust >= 10) return { title: "Known Crook", multiplier: 1.1 };
        if (trust < 0) return { title: "Suspected Snitch", multiplier: 0.8 };
        return { title: "Random Cunt", multiplier: 1.0 };
    }

    // Helper method to identify system users
    isSystemUser(username) {
        // Check if username matches system user patterns
        // System users typically have brackets like [server], [voteskip], etc.
        if (username.startsWith('[') && username.endsWith(']')) {
            return true;
        }
        
        // Additional known system users
        const systemUsers = ['server', '[server]', '[voteskip]', '[playlist]', '[drink]'];
        return systemUsers.includes(username.toLowerCase());
    }

    // Handle bot messages
    async handleMessage(username, message) {
        // Exclude system users from all heist interactions
        if (this.isSystemUser(username)) {
            return;
        }
        
        // Track activity
        await this.trackActivity(username);
        
        // Check for votes during voting phase
        if (this.currentState === this.states.VOTING) {
            // Only check against the 2 crimes offered in this heist
            const crimes = this.currentHeistCrimes;
            const lowercaseMsg = message.toLowerCase().trim();
            
            // Look for exact matches or very clear intentions
            let votedCrime = null;
            
            // First check for exact single-word messages
            for (const crime of crimes) {
                if (lowercaseMsg === crime.id.toLowerCase() || lowercaseMsg === crime.name.toLowerCase()) {
                    votedCrime = crime;
                    break;
                }
            }
            
            // If no exact match, check for word boundaries to avoid false positives
            if (!votedCrime) {
                for (const crime of crimes) {
                    // Escape special regex characters
                    const escapedId = crime.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Create regex to match whole words only
                    const idRegex = new RegExp(`\\b${escapedId}\\b`, 'i');
                    const nameWords = crime.name.split(' ');
                    
                    // Check if message contains the crime ID as a whole word
                    if (idRegex.test(message)) {
                        votedCrime = crime;
                        break;
                    }
                    
                    // Check if message contains all words from the crime name
                    const hasAllWords = nameWords.every(word => {
                        // Escape special regex characters
                        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
                        return wordRegex.test(message);
                    });
                    
                    if (hasAllWords) {
                        votedCrime = crime;
                        break;
                    }
                }
            }
            
            // Register vote if we found a match
            if (votedCrime) {
                const previousVote = this.votes.get(username);
                const voted = await this.vote(username, votedCrime.id);
                
                if (voted) {
                    // Log vote for debugging
                    this.logger.debug(`Vote registered: ${username} -> ${votedCrime.name}`);
                    
                    // Emit vote event for feedback (bot can respond if desired)
                    this.emit('vote_registered', {
                        username: username,
                        crime: votedCrime.name,
                        changed: previousVote && previousVote !== votedCrime.id
                    });
                }
            }
        }
    }

    // Resume interrupted heist after restart
    async resumeInterruptedHeist(savedState) {
        this.logger.info(`Resuming interrupted heist in state: ${savedState}`);
        this.currentState = savedState;
        
        try {
            // Load saved data
            const timerEndTime = await this.getConfig('state_timer_end');
            const heistId = await this.getConfig('current_heist_id');
            
            if (heistId) {
                this.currentHeistId = parseInt(heistId);
            }
            
            switch (savedState) {
                case this.states.VOTING:
                    await this.resumeVoting(timerEndTime);
                    break;
                case this.states.IN_PROGRESS:
                    await this.resumeInProgress(timerEndTime);
                    break;
                case this.states.COOLDOWN:
                    await this.resumeCooldown(timerEndTime);
                    break;
                case this.states.ANNOUNCING:
                case this.states.DISTRIBUTING:
                    // These are transient states, reset to idle
                    this.logger.warn(`Cannot resume transient state ${savedState}, resetting to idle`);
                    await this.setState(this.states.IDLE);
                    this.scheduleRandomHeist();
                    break;
                default:
                    // Unknown state, reset
                    await this.setState(this.states.IDLE);
                    this.scheduleRandomHeist();
            }
        } catch (error) {
            this.logger.error('Failed to resume interrupted heist:', error);
            await this.cleanupHeistState();
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
        }
    }
    
    async resumeVoting(timerEndTime) {
        if (!timerEndTime) {
            this.logger.warn('No voting end time found, resetting to idle');
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
            return;
        }
        
        const timeRemaining = parseInt(timerEndTime) - Date.now();
        
        if (timeRemaining <= 0) {
            // Voting period expired during downtime
            this.logger.info('Voting period expired during downtime, executing heist');
            await this.loadVotingData();
            await this.executeHeist();
        } else {
            // Resume voting
            this.logger.info(`Resuming voting with ${Math.round(timeRemaining / 1000)}s remaining`);
            await this.loadVotingData();
            
            // Announce resumption
            this.emit('resume_voting', {
                message: "oi cunts, the heist vote's still on! get your choices in!",
                timeRemaining: timeRemaining
            });
            
            this.stateTimer = setTimeout(() => {
                if (this.currentState === this.states.VOTING) {
                    this.executeHeist();
                }
            }, timeRemaining);
        }
    }
    
    async resumeInProgress(timerEndTime) {
        if (!timerEndTime) {
            this.logger.warn('No crime end time found, completing with failure');
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
            return;
        }
        
        const timeRemaining = parseInt(timerEndTime) - Date.now();
        const crimeId = await this.getConfig('current_crime_id');
        
        // Load crime data
        const crimes = contentLoader.getCrimes();
        const crime = crimes.find(c => c.id === crimeId);
        
        if (!crime) {
            this.logger.error('Could not find crime data for resumed heist');
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
            return;
        }
        
        if (timeRemaining <= 0) {
            // Crime completed during downtime
            this.logger.info('Heist completed during downtime');
            await this.loadVotingData();
            await this.completeHeist(crime);
        } else {
            // Resume in progress
            this.logger.info(`Resuming heist in progress with ${Math.round(timeRemaining / 1000)}s remaining`);
            await this.loadVotingData();
            
            // Announce resumption
            this.emit('resume_progress', {
                message: `still out on the ${crime.name} job, back soon cunts`,
                timeRemaining: timeRemaining
            });
            
            this.stateTimer = setTimeout(() => {
                if (this.currentState === this.states.IN_PROGRESS) {
                    this.completeHeist(crime);
                }
            }, timeRemaining);
        }
    }
    
    async resumeCooldown(timerEndTime) {
        if (!timerEndTime) {
            // No cooldown end time, just go to idle
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
            return;
        }
        
        const timeRemaining = parseInt(timerEndTime) - Date.now();
        
        if (timeRemaining <= 0) {
            // Cooldown expired during downtime
            this.logger.info('Cooldown expired during downtime');
            await this.setState(this.states.IDLE);
            this.scheduleRandomHeist();
        } else {
            // Resume cooldown
            this.logger.info(`Resuming cooldown with ${Math.round(timeRemaining / 1000)}s remaining`);
            
            this.stateTimer = setTimeout(async () => {
                await this.setState(this.states.IDLE);
                this.scheduleRandomHeist();
            }, timeRemaining);
        }
    }
    
    async loadVotingData() {
        // Load votes and crime data from database
        if (!this.currentHeistId) return;
        
        try {
            // Load current crimes
            const savedCrimes = await this.getConfig('current_crimes');
            if (savedCrimes) {
                this.currentHeistCrimes = JSON.parse(savedCrimes);
            }
            
            // Load votes from participants table
            const participants = await this.db.all(
                'SELECT username, vote FROM heist_participants WHERE heist_id = ?',
                [this.currentHeistId]
            );
            
            this.votes.clear();
            for (const p of participants) {
                if (p.vote) {
                    this.votes.set(p.username, p.vote);
                }
            }
            
            this.logger.debug(`Loaded ${this.votes.size} votes for heist ${this.currentHeistId}`);
        } catch (error) {
            this.logger.error('Failed to load voting data:', error);
        }
    }
    
    // Clean up heist state on errors
    async cleanupHeistState() {
        // Clear timers
        if (this.stateTimer) {
            clearTimeout(this.stateTimer);
            this.stateTimer = null;
        }
        
        // Clear heist data
        this.currentHeistId = null;
        this.currentHeistCrimes = [];
        this.votes.clear();
        
        // Clear saved state data
        await this.db.run('DELETE FROM heist_config WHERE key IN (?, ?, ?, ?)', 
            ['state_timer_end', 'current_heist_id', 'current_crimes', 'current_crime_id']);
        
        this.logger.debug('Cleaned up heist state');
    }

    // Clean shutdown
    async shutdown() {
        if (this.nextHeistTimer) clearTimeout(this.nextHeistTimer);
        if (this.stateTimer) clearTimeout(this.stateTimer);
        if (this.activityCheckInterval) clearInterval(this.activityCheckInterval);
        
        // Save current state
        await this.setConfig('heist_state', this.currentState);
        
        this.logger.info('HeistManager shut down');
    }
}