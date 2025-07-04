class EconomyService {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }

    async init() {
        // Create economy tables
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_economy (
                username TEXT PRIMARY KEY,
                balance INTEGER DEFAULT 100,
                total_earned INTEGER DEFAULT 0,
                total_spent INTEGER DEFAULT 0,
                last_daily INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user TEXT,
                to_user TEXT,
                amount INTEGER NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                timestamp INTEGER NOT NULL,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS bong_counter (
                date TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_bongs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS drink_counter (
                date TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_drinks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_user);
            CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_user);
            CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
            CREATE INDEX IF NOT EXISTS idx_user_bongs_username ON user_bongs(username);
            CREATE INDEX IF NOT EXISTS idx_user_bongs_timestamp ON user_bongs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_user_drinks_username ON user_drinks(username);
            CREATE INDEX IF NOT EXISTS idx_user_drinks_timestamp ON user_drinks(timestamp);
        `);
    }

    // ===== Balance Management =====

    async getBalance(username) {
        const user = await this.db.get(
            'SELECT balance FROM user_economy WHERE username = ?',
            [username]
        );
        return user ? user.balance : 0;
    }

    async ensureUser(username, startingBalance = 100) {
        const existing = await this.db.get(
            'SELECT username FROM user_economy WHERE username = ?',
            [username]
        );

        if (!existing) {
            await this.db.run(
                `INSERT INTO user_economy (username, balance, total_earned)
                 VALUES (?, ?, ?)`,
                [username, startingBalance, startingBalance]
            );
            
            await this.recordTransaction(
                null,
                username,
                startingBalance,
                'initial',
                'Starting balance'
            );
        }
    }

    async updateBalance(username, amount, operation = 'add') {
        await this.ensureUser(username);

        if (operation === 'add') {
            await this.db.run(
                `UPDATE user_economy 
                 SET balance = balance + ?,
                     total_earned = total_earned + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE username = ?`,
                [amount, amount, username]
            );
        } else if (operation === 'subtract') {
            const result = await this.db.run(
                `UPDATE user_economy 
                 SET balance = balance - ?,
                     total_spent = total_spent + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE username = ? AND balance >= ?`,
                [amount, amount, username, amount]
            );
            
            if (result.changes === 0) {
                throw new Error('Insufficient balance');
            }
        } else if (operation === 'set') {
            await this.db.run(
                `UPDATE user_economy 
                 SET balance = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE username = ?`,
                [amount, username]
            );
        }

        const newBalance = await this.getBalance(username);
        return newBalance;
    }

    async transfer(fromUser, toUser, amount) {
        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }

        // Use transaction to ensure atomicity
        await this.db.exec('BEGIN TRANSACTION');
        
        try {
            // Check sender balance
            const senderBalance = await this.getBalance(fromUser);
            if (senderBalance < amount) {
                throw new Error('Insufficient balance');
            }

            // Ensure recipient exists
            await this.ensureUser(toUser);

            // Update balances
            await this.updateBalance(fromUser, amount, 'subtract');
            await this.updateBalance(toUser, amount, 'add');

            // Record transaction
            await this.recordTransaction(
                fromUser,
                toUser,
                amount,
                'transfer',
                `Transfer from ${fromUser} to ${toUser}`
            );

            await this.db.exec('COMMIT');
            
            return {
                success: true,
                fromBalance: await this.getBalance(fromUser),
                toBalance: await this.getBalance(toUser)
            };
        } catch (error) {
            await this.db.exec('ROLLBACK');
            throw error;
        }
    }

    // ===== Transactions =====

    async recordTransaction(fromUser, toUser, amount, type, description, metadata = null) {
        await this.db.run(
            `INSERT INTO transactions 
             (from_user, to_user, amount, type, description, timestamp, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                fromUser,
                toUser,
                amount,
                type,
                description,
                Date.now(),
                metadata ? JSON.stringify(metadata) : null
            ]
        );
    }

    async getTransactions(username, options = {}) {
        const { limit = 50, offset = 0, type = null } = options;

        let query = `
            SELECT * FROM transactions 
            WHERE (from_user = ? OR to_user = ?)
        `;
        const params = [username, username];

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const transactions = await this.db.all(query, params);

        // Parse metadata
        return transactions.map(t => ({
            ...t,
            metadata: t.metadata ? JSON.parse(t.metadata) : null
        }));
    }

    // ===== Daily Bonus =====

    async claimDaily(username, amount = 50) {
        await this.ensureUser(username);

        const user = await this.db.get(
            'SELECT last_daily FROM user_economy WHERE username = ?',
            [username]
        );

        const now = Date.now();
        const lastClaim = user.last_daily || 0;
        const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

        if (hoursSinceLastClaim < 24) {
            const hoursRemaining = Math.ceil(24 - hoursSinceLastClaim);
            return {
                success: false,
                hoursRemaining,
                message: `Daily bonus already claimed. Try again in ${hoursRemaining} hours.`
            };
        }

        await this.db.run(
            'UPDATE user_economy SET last_daily = ? WHERE username = ?',
            [now, username]
        );

        const newBalance = await this.updateBalance(username, amount, 'add');
        
        await this.recordTransaction(
            null,
            username,
            amount,
            'daily',
            'Daily bonus claimed'
        );

        return {
            success: true,
            amount,
            newBalance
        };
    }

    // ===== Leaderboard =====

    async getLeaderboard(limit = 10) {
        return await this.db.all(
            `SELECT username, balance, total_earned, total_spent
             FROM user_economy
             ORDER BY balance DESC
             LIMIT ?`,
            [limit]
        );
    }

    async getUserRank(username) {
        const result = await this.db.get(
            `SELECT COUNT(*) + 1 as rank
             FROM user_economy
             WHERE balance > (
                 SELECT balance FROM user_economy WHERE username = ?
             )`,
            [username]
        );

        return result ? result.rank : null;
    }

    // ===== Bong Counter =====

    async incrementBongCounter() {
        const dateStr = new Date().toDateString();
        
        await this.db.run(
            `INSERT INTO bong_counter (date, count) VALUES (?, 1)
             ON CONFLICT(date) DO UPDATE SET 
             count = count + 1,
             updated_at = CURRENT_TIMESTAMP`,
            [dateStr]
        );

        const result = await this.db.get(
            'SELECT count FROM bong_counter WHERE date = ?',
            [dateStr]
        );

        return result.count;
    }

    async recordUserBong(username) {
        await this.db.run(
            'INSERT INTO user_bongs (username, timestamp) VALUES (?, ?)',
            [username, Date.now()]
        );
    }

    async getBongStats(days = 7) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const daily = await this.db.all(
            'SELECT date, count FROM bong_counter ORDER BY date DESC LIMIT ?',
            [days]
        );

        const userStats = await this.db.all(
            `SELECT username, COUNT(*) as count
             FROM user_bongs
             WHERE timestamp > ?
             GROUP BY username
             ORDER BY count DESC
             LIMIT 10`,
            [since]
        );

        return { daily, userStats };
    }

    // ===== Drink Counter =====

    async incrementDrinkCounter() {
        const dateStr = new Date().toDateString();
        
        await this.db.run(
            `INSERT INTO drink_counter (date, count) VALUES (?, 1)
             ON CONFLICT(date) DO UPDATE SET 
             count = count + 1,
             updated_at = CURRENT_TIMESTAMP`,
            [dateStr]
        );

        const result = await this.db.get(
            'SELECT count FROM drink_counter WHERE date = ?',
            [dateStr]
        );

        return result.count;
    }

    async recordUserDrink(username) {
        await this.db.run(
            'INSERT INTO user_drinks (username, timestamp) VALUES (?, ?)',
            [username, Date.now()]
        );
    }

    async getDrinkStats(days = 7) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const daily = await this.db.all(
            'SELECT date, count FROM drink_counter ORDER BY date DESC LIMIT ?',
            [days]
        );

        const userStats = await this.db.all(
            `SELECT username, COUNT(*) as count
             FROM user_drinks
             WHERE timestamp > ?
             GROUP BY username
             ORDER BY count DESC
             LIMIT 10`,
            [since]
        );

        return { daily, userStats };
    }

    // ===== Economy Statistics =====

    async getEconomyStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_users,
                SUM(balance) as total_money,
                AVG(balance) as avg_balance,
                MAX(balance) as max_balance,
                MIN(balance) as min_balance
            FROM user_economy
        `);

        const recentTransactions = await this.db.get(`
            SELECT 
                COUNT(*) as count,
                SUM(amount) as volume
            FROM transactions
            WHERE timestamp > ?`,
            [Date.now() - (24 * 60 * 60 * 1000)]
        );

        return {
            ...stats,
            recentTransactions
        };
    }
}

module.exports = EconomyService;