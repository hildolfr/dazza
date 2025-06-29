/**
 * Cash Monitor - Logs all balance changes for users
 * Polls the database every 5-10 seconds and reports changes
 */

export class CashMonitor {
    constructor(database, logger, interval = 10000) {
        this.db = database;
        this.logger = logger;
        this.interval = interval;
        this.previousBalances = new Map();
        this.isRunning = false;
        this.intervalId = null;
        this.debugMode = false; // Set to true for verbose logging
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Cash monitor is already running');
            return;
        }

        this.logger.info('Starting cash monitor...');
        this.isRunning = true;

        // Get initial balances
        const initialBalances = await this.updateBalances();
        this.previousBalances = initialBalances;
        this.logger.info(`Cash monitor initialized with ${initialBalances.size} users`);

        // Start polling
        this.intervalId = setInterval(async () => {
            await this.checkForChanges();
        }, this.interval);
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping cash monitor...');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async updateBalances() {
        try {
            const users = await this.db.all(
                'SELECT username, balance FROM user_economy ORDER BY username'
            );

            const newBalances = new Map();
            for (const user of users) {
                newBalances.set(user.username, user.balance);
            }

            return newBalances;
        } catch (error) {
            this.logger.error('Error fetching balances:', error);
            return new Map();
        }
    }

    async checkForChanges() {
        try {
            const currentBalances = await this.updateBalances();
            const changes = [];
            const timestamp = new Date().toISOString().substring(11, 19); // HH:MM:SS

            // Debug: Log check info every 5th check (50 seconds)
            if (Math.random() < 0.2) {
                this.logger.debug(`Cash monitor check: tracking ${currentBalances.size} users, previous: ${this.previousBalances.size}`);
            }

            // Check for changes in existing users
            for (const [username, newBalance] of currentBalances) {
                const oldBalance = this.previousBalances.get(username);
                
                if (oldBalance !== undefined && oldBalance !== newBalance) {
                    const change = newBalance - oldBalance;
                    changes.push({
                        username,
                        oldBalance,
                        newBalance,
                        change,
                        changeStr: change > 0 ? `+$${change}` : `-$${Math.abs(change)}`
                    });
                }
            }

            // Check for users who had balance but now don't (shouldn't happen often)
            for (const [username, oldBalance] of this.previousBalances) {
                if (!currentBalances.has(username)) {
                    changes.push({
                        username,
                        oldBalance,
                        newBalance: 0,
                        change: -oldBalance,
                        changeStr: `-$${oldBalance}`
                    });
                }
            }

            // Log changes if any
            if (changes.length > 0) {
                console.log(`\n[${timestamp}] 💰 BALANCE CHANGES DETECTED:`);
                console.log('─'.repeat(60));
                
                for (const change of changes) {
                    const arrow = change.change > 0 ? '↑' : '↓';
                    const color = change.change > 0 ? '\x1b[32m' : '\x1b[31m'; // green for up, red for down
                    const reset = '\x1b[0m';
                    
                    console.log(
                        `${color}${arrow}${reset} ${change.username.padEnd(20)} ` +
                        `${color}${change.changeStr.padStart(10)}${reset} ` +
                        `($${change.oldBalance} → $${change.newBalance})`
                    );
                }
                
                console.log('─'.repeat(60));
            } else if (this.debugMode) {
                console.log(`[${timestamp}] Cash monitor: No changes detected (${currentBalances.size} users tracked)`);
            }

            // Update our stored balances
            this.previousBalances = currentBalances;

        } catch (error) {
            this.logger.error('Error checking for balance changes:', error);
        }
    }

    // Get current monitoring stats
    getStats() {
        return {
            isRunning: this.isRunning,
            usersTracked: this.previousBalances.size,
            totalBalance: Array.from(this.previousBalances.values()).reduce((sum, bal) => sum + bal, 0),
            interval: this.interval
        };
    }

    // Change polling interval
    setInterval(newInterval) {
        this.interval = newInterval;
        
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    // Enable/disable debug mode
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.logger.info(`Cash monitor debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
}