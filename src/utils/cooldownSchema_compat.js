/**
 * Compatibility schema for existing cooldowns table
 */

export const cooldownSchema = {
    async initialize(database) {
        // Table already exists, just ensure indexes are created
        try {
            await database.run('CREATE INDEX IF NOT EXISTS idx_cooldowns_command_username ON cooldowns(command_name, username)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_cooldowns_last_used ON cooldowns(last_used)');
        } catch (error) {
            console.log('Some cooldown indexes may already exist, continuing...');
        }
        
        console.log('Cooldowns table compatibility check completed');
    }
};