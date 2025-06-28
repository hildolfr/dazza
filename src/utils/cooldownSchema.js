export const cooldownSchema = {
    async initialize(database) {
        // Create cooldowns table
        await database.run(`
            CREATE TABLE IF NOT EXISTS cooldowns (
                command_name TEXT NOT NULL,
                username TEXT NOT NULL,
                last_used INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (command_name, username)
            )
        `);

        // Create index for faster lookups
        await database.run('CREATE INDEX IF NOT EXISTS idx_cooldowns_last_used ON cooldowns(last_used)');
        
        console.log('Cooldowns table initialized');
    }
};