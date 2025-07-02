export const cooldownSchema = {
    // SQL for creating cooldowns table
    createCooldownsTable: `
        CREATE TABLE IF NOT EXISTS cooldowns (
            command_name TEXT NOT NULL,
            username TEXT NOT NULL,
            last_used INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (command_name, username)
        )
    `,

    // Index creation SQL
    createCooldownKeyIndex: 'CREATE INDEX IF NOT EXISTS idx_cooldowns_command_username ON cooldowns(command_name, username)',
    createCooldownExpiresIndex: 'CREATE INDEX IF NOT EXISTS idx_cooldowns_last_used ON cooldowns(last_used)',

    // Keep the initialize method for backward compatibility
    async initialize(database) {
        // Create cooldowns table
        await database.run(this.createCooldownsTable);

        // Create indexes for faster lookups
        await database.run(this.createCooldownKeyIndex);
        await database.run(this.createCooldownExpiresIndex);
        
        console.log('Cooldowns table initialized');
    }
};