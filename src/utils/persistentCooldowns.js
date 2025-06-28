export class PersistentCooldownManager {
    constructor(database) {
        this.database = database;
    }

    async check(commandName, username, duration) {
        const now = Date.now();
        
        try {
            // Get last used time from database
            const result = await this.database.get(
                'SELECT last_used FROM cooldowns WHERE command_name = ? AND LOWER(username) = LOWER(?)',
                [commandName, username]
            );
            
            if (result && (now - result.last_used) < duration) {
                const remaining = Math.ceil((duration - (now - result.last_used)) / 1000);
                return { allowed: false, remaining };
            }
            
            // Only update the cooldown if the command is allowed
            // This prevents resetting the cooldown when users spam commands
            await this.database.run(`
                INSERT INTO cooldowns (command_name, username, last_used)
                VALUES (?, ?, ?)
                ON CONFLICT(command_name, username) DO UPDATE SET
                    last_used = ?
            `, [commandName, username.toLowerCase(), now, now]);
            
            return { allowed: true };
            
        } catch (error) {
            console.error('PersistentCooldownManager error:', error);
            // In case of error, allow the command (fail open)
            return { allowed: true };
        }
    }

    async reset(commandName, username) {
        try {
            await this.database.run(
                'DELETE FROM cooldowns WHERE command_name = ? AND LOWER(username) = LOWER(?)',
                [commandName, username]
            );
        } catch (error) {
            console.error('PersistentCooldownManager reset error:', error);
        }
    }

    async clear(commandName = null) {
        try {
            if (commandName) {
                await this.database.run(
                    'DELETE FROM cooldowns WHERE command_name = ?',
                    [commandName]
                );
            } else {
                await this.database.run('DELETE FROM cooldowns');
            }
        } catch (error) {
            console.error('PersistentCooldownManager clear error:', error);
        }
    }

    async getCooldown(commandName, username) {
        try {
            const result = await this.database.get(
                'SELECT last_used FROM cooldowns WHERE command_name = ? AND LOWER(username) = LOWER(?)',
                [commandName, username]
            );
            return result ? result.last_used : null;
        } catch (error) {
            console.error('PersistentCooldownManager getCooldown error:', error);
            return null;
        }
    }

    async cleanupOldCooldowns(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        // Clean up cooldowns older than maxAge (default 7 days)
        try {
            const cutoffTime = Date.now() - maxAgeMs;
            await this.database.run(
                'DELETE FROM cooldowns WHERE last_used < ?',
                [cutoffTime]
            );
        } catch (error) {
            console.error('PersistentCooldownManager cleanup error:', error);
        }
    }
}