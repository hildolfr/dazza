/**
 * Database schema for the heist economy system
 * This is imported by database.js to initialize tables
 */

export const heistSchema = {
    async initialize(db) {
        // User economy balances and trust
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_economy (
                username TEXT PRIMARY KEY,
                balance INTEGER DEFAULT 0 CHECK (balance >= 0),
                trust INTEGER DEFAULT 0,
                total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
                total_lost INTEGER DEFAULT 0 CHECK (total_lost >= 0),
                heists_participated INTEGER DEFAULT 0 CHECK (heists_participated >= 0),
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

        // Heist event tracking
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL,
                crime_type TEXT,
                announced_at INTEGER,
                departed_at INTEGER,
                returned_at INTEGER,
                completed_at INTEGER,
                total_haul INTEGER DEFAULT 0,
                success BOOLEAN DEFAULT 1,
                participants_count INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        `);

        // Track voting participants
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_participants (
                heist_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                vote TEXT,
                money_earned INTEGER DEFAULT 0,
                trust_gained INTEGER DEFAULT 0,
                participated_at INTEGER NOT NULL,
                PRIMARY KEY (heist_id, username),
                FOREIGN KEY (heist_id) REFERENCES heist_events(id)
            )
        `);

        // System state and configuration
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

        // Transaction log for auditing
        await db.run(`
            CREATE TABLE IF NOT EXISTS economy_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                amount INTEGER NOT NULL,
                trust_change INTEGER DEFAULT 0,
                transaction_type TEXT NOT NULL,
                heist_id INTEGER,
                description TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (heist_id) REFERENCES heist_events(id)
            )
        `);

        // Activity tracking for heist triggers
        await db.run(`
            CREATE TABLE IF NOT EXISTS channel_activity (
                timestamp INTEGER PRIMARY KEY,
                message_count INTEGER DEFAULT 0,
                unique_users INTEGER DEFAULT 0
            )
        `);

        // Crime types configuration
        await db.run(`
            CREATE TABLE IF NOT EXISTS crime_types (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                min_payout INTEGER NOT NULL CHECK (min_payout >= 0),
                max_payout INTEGER NOT NULL CHECK (max_payout >= min_payout),
                success_rate REAL NOT NULL CHECK (success_rate >= 0 AND success_rate <= 1),
                created_at INTEGER NOT NULL
            )
        `);

        // Create indexes
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_economy_trust ON user_economy(trust)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_heist_events_state ON heist_events(state)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_economy_transactions_username ON economy_transactions(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_economy_transactions_heist ON economy_transactions(heist_id)');

        // Initialize default crime types
        await initializeCrimeTypes(db);
    }
};

async function initializeCrimeTypes(db) {
    // Import crimes from content file
    try {
        const { contentLoader } = await import('./contentLoader.js');
        await contentLoader.loadContent();
        const crimes = contentLoader.getCrimes();

        // Clear existing crimes to sync with content file
        await db.run('DELETE FROM crime_types');

        for (const crime of crimes) {
            await db.run(`
                INSERT INTO crime_types (id, name, min_payout, max_payout, success_rate, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [crime.id, crime.name, crime.min_payout, crime.max_payout, crime.success_rate, Date.now()]);
        }
    } catch (error) {
        // Fallback to basic crimes if content loading fails
        const fallbackCrimes = [
            { id: 'servo', name: 'servo run', min_payout: 50, max_payout: 150, success_rate: 0.9 },
            { id: 'bottleo', name: 'bottle-o raid', min_payout: 100, max_payout: 300, success_rate: 0.8 },
            { id: 'snags', name: 'bunnings snag theft', min_payout: 20, max_payout: 80, success_rate: 0.95 },
            { id: 'pokies', name: 'pokie scam', min_payout: 200, max_payout: 500, success_rate: 0.7 },
            { id: 'centrelink', name: 'centrelink fraud', min_payout: 300, max_payout: 800, success_rate: 0.6 }
        ];

        for (const crime of fallbackCrimes) {
            await db.run(`
                INSERT OR IGNORE INTO crime_types (id, name, min_payout, max_payout, success_rate, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [crime.id, crime.name, crime.min_payout, crime.max_payout, crime.success_rate, Date.now()]);
        }
    }
}