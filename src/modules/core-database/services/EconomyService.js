class EconomyService {
    constructor(db, module) {
        this.db = db;
        this.module = module;
        this.logger = module.logger;
        this.startingBalance = 1000;
    }
    
    async init() {
        // Load config
        const economyConfig = this.module.config.economy || {};
        this.startingBalance = economyConfig.startingBalance || 1000;
    }
    
    // ===== Balance Management =====
    
    async getBalance(username) {
        const result = await this.db.get(
            'SELECT balance FROM balances WHERE username = ?',
            [username]
        );
        
        if (!result) {
            // Create new balance
            await this.createBalance(username);
            return this.startingBalance;
        }
        
        return result.balance;
    }
    
    async createBalance(username) {
        try {
            await this.db.run(
                `INSERT INTO balances (username, balance, created_at, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [username, this.startingBalance]
            );
        } catch (error) {
            // Handle race condition - balance might have been created
            if (error.code !== 'SQLITE_CONSTRAINT') {
                throw error;
            }
        }
    }
    
    async setBalance(username, amount) {
        await this.db.run(
            `INSERT INTO balances (username, balance, created_at, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(username) DO UPDATE SET
             balance = ?,
             updated_at = CURRENT_TIMESTAMP`,
            [username, amount, amount]
        );
    }
    
    async updateUserBalance(username, amount) {
        // Ensure user exists first
        await this.getBalance(username);
        
        const result = await this.db.run(
            `UPDATE balances SET 
             balance = balance + ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE username = ?`,
            [amount, username]
        );
        
        // Get the new balance
        const newBalance = await this.getBalance(username);
        return newBalance;
    }
    
    async transferBalance(fromUser, toUser, amount) {
        const fromBalance = await this.getBalance(fromUser);
        
        if (fromBalance < amount) {
            throw new Error('Insufficient funds');
        }
        
        // Use transaction for safety
        await this.module.transaction(async () => {
            await this.updateUserBalance(fromUser, -amount);
            await this.updateUserBalance(toUser, amount);
        });
        
        return true;
    }
    
    // ===== Trust System =====
    
    async getUserTrust(username) {
        const result = await this.db.get(
            'SELECT trust FROM user_trust WHERE username = ?',
            [username]
        );
        
        if (!result) {
            // Create new trust entry
            await this.createUserTrust(username);
            return 0;
        }
        
        return result.trust;
    }
    
    async createUserTrust(username) {
        try {
            await this.db.run(
                `INSERT INTO user_trust (username, trust, created_at, updated_at)
                 VALUES (?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [username]
            );
        } catch (error) {
            // Handle race condition
            if (error.code !== 'SQLITE_CONSTRAINT') {
                throw error;
            }
        }
    }
    
    async updateUserTrust(username, amount) {
        // Ensure user exists first
        await this.getUserTrust(username);
        
        await this.db.run(
            `UPDATE user_trust SET 
             trust = trust + ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE username = ?`,
            [amount, username]
        );
        
        return await this.getUserTrust(username);
    }
    
    // ===== Legacy Compatibility Methods =====
    
    async getUserBalance(username) {
        const balance = await this.getBalance(username);
        const trust = await this.getUserTrust(username);
        
        // Return in legacy format
        return {
            balance: balance,
            trust: trust,
            trustLevel: this.getTrustLevel(trust)
        };
    }
    
    getTrustLevel(trust) {
        // Simple trust level system
        if (trust < 0) {
            return { title: 'Untrusted', level: 0 };
        } else if (trust < 10) {
            return { title: 'Rookie', level: 1 };
        } else if (trust < 50) {
            return { title: 'Trusted', level: 2 };
        } else if (trust < 100) {
            return { title: 'Veteran', level: 3 };
        } else {
            return { title: 'Legend', level: 4 };
        }
    }
    
    // ===== Statistics =====
    
    async getTopBalances(limit = 10) {
        return await this.db.all(
            `SELECT username, balance FROM balances 
             ORDER BY balance DESC 
             LIMIT ?`,
            [limit]
        );
    }
    
    async getEconomyStats() {
        const result = await this.db.get(
            `SELECT 
                COUNT(*) as total_users,
                SUM(balance) as total_money,
                AVG(balance) as avg_balance,
                MAX(balance) as max_balance,
                MIN(balance) as min_balance
             FROM balances`
        );
        
        return result;
    }
    
    async addBalance(username, amount) {
        await this.db.run(
            `INSERT INTO balances (username, balance)
             VALUES (?, ?)
             ON CONFLICT(username) DO UPDATE SET
             balance = balance + ?,
             updated_at = CURRENT_TIMESTAMP`,
            [username, this.startingBalance + amount, amount]
        );
        
        return await this.getBalance(username);
    }
    
    async deductBalance(username, amount) {
        const currentBalance = await this.getBalance(username);
        
        if (currentBalance < amount) {
            return { success: false, error: 'Insufficient balance' };
        }
        
        await this.db.run(
            `UPDATE balances 
             SET balance = balance - ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE username = ?`,
            [amount, username]
        );
        
        return { success: true, newBalance: currentBalance - amount };
    }
    
    // ===== Transactions =====
    
    async transfer(fromUser, toUser, amount, description = 'Transfer') {
        if (amount <= 0) {
            return { success: false, error: 'Amount must be positive' };
        }
        
        // Start transaction
        await this.db.exec('BEGIN TRANSACTION');
        
        try {
            // Check sender balance
            const senderBalance = await this.getBalance(fromUser);
            if (senderBalance < amount) {
                await this.db.exec('ROLLBACK');
                return { success: false, error: 'Insufficient balance' };
            }
            
            // Deduct from sender
            await this.deductBalance(fromUser, amount);
            
            // Add to receiver
            await this.addBalance(toUser, amount);
            
            // Record transaction
            await this.recordTransaction(fromUser, toUser, amount, 'transfer', description);
            
            await this.db.exec('COMMIT');
            
            return { 
                success: true, 
                senderBalance: senderBalance - amount,
                receiverBalance: await this.getBalance(toUser)
            };
            
        } catch (error) {
            await this.db.exec('ROLLBACK');
            this.logger.error('Transfer failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async recordTransaction(fromUser, toUser, amount, type, description = null) {
        await this.db.run(
            `INSERT INTO transactions (from_user, to_user, amount, type, description, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [fromUser, toUser, amount, type, description, Date.now()]
        );
    }
    
    // ===== Daily Rewards =====
    
    async claimDaily(username) {
        const user = await this.db.get(
            'SELECT last_daily FROM balances WHERE username = ?',
            [username]
        );
        
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        if (user && user.last_daily) {
            const timeSinceLastDaily = now - user.last_daily;
            if (timeSinceLastDaily < oneDayMs) {
                const timeRemaining = oneDayMs - timeSinceLastDaily;
                const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
                const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
                
                return {
                    success: false,
                    error: `Daily already claimed. Try again in ${hours}h ${minutes}m`
                };
            }
        }
        
        // Give daily reward
        const dailyAmount = this.module.config.economy?.dailyAmount || 100;
        
        await this.db.run(
            `INSERT INTO balances (username, balance, last_daily)
             VALUES (?, ?, ?)
             ON CONFLICT(username) DO UPDATE SET
             balance = balance + ?,
             last_daily = ?,
             updated_at = CURRENT_TIMESTAMP`,
            [username, this.startingBalance + dailyAmount, now, dailyAmount, now]
        );
        
        // Record transaction
        await this.recordTransaction(null, username, dailyAmount, 'daily', 'Daily reward');
        
        const newBalance = await this.getBalance(username);
        
        return {
            success: true,
            amount: dailyAmount,
            newBalance
        };
    }
    
    // ===== Leaderboard =====
    
    async getLeaderboard(limit = 10) {
        return await this.db.all(
            `SELECT username, balance
             FROM balances
             ORDER BY balance DESC
             LIMIT ?`,
            [limit]
        );
    }
    
    async getRank(username) {
        const result = await this.db.get(
            `SELECT COUNT(*) + 1 as rank
             FROM balances
             WHERE balance > (
                 SELECT balance FROM balances WHERE username = ?
             )`,
            [username]
        );
        
        return result ? result.rank : null;
    }
    
    // ===== Transaction History =====
    
    async getTransactions(username, limit = 50) {
        return await this.db.all(
            `SELECT * FROM transactions
             WHERE from_user = ? OR to_user = ?
             ORDER BY timestamp DESC
             LIMIT ?`,
            [username, username, limit]
        );
    }
    
    async getRecentTransactions(limit = 20) {
        return await this.db.all(
            `SELECT * FROM transactions
             ORDER BY timestamp DESC
             LIMIT ?`,
            [limit]
        );
    }
    
    // ===== Detailed Statistics =====
    
    async getDetailedEconomyStats() {
        const [totalUsers, totalBalance, avgBalance, transactions] = await Promise.all([
            this.db.get('SELECT COUNT(*) as count FROM balances'),
            this.db.get('SELECT SUM(balance) as total FROM balances'),
            this.db.get('SELECT AVG(balance) as average FROM balances'),
            this.db.get('SELECT COUNT(*) as count FROM transactions WHERE timestamp > ?', 
                [Date.now() - (24 * 60 * 60 * 1000)])
        ]);
        
        return {
            totalUsers: totalUsers.count,
            totalBalance: totalBalance.total || 0,
            averageBalance: Math.round(avgBalance.average || 0),
            dailyTransactions: transactions.count
        };
    }
    
    // ===== Bulk Operations =====
    
    async resetEconomy() {
        await this.db.exec('BEGIN TRANSACTION');
        
        try {
            await this.db.run('DELETE FROM balances');
            await this.db.run('DELETE FROM transactions');
            await this.db.exec('COMMIT');
            
            this.logger.info('Economy reset completed');
            return { success: true };
            
        } catch (error) {
            await this.db.exec('ROLLBACK');
            this.logger.error('Economy reset failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async giveEveryoneBalance(amount) {
        await this.db.run(
            `UPDATE balances 
             SET balance = balance + ?,
                 updated_at = CURRENT_TIMESTAMP`,
            [amount]
        );
        
        const affected = await this.db.get(
            'SELECT changes() as count'
        );
        
        return affected.count;
    }
}

module.exports = EconomyService;