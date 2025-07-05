export async function up(db) {
    // Check which columns already exist
    const tableInfo = await db.all("PRAGMA table_info(user_images)");
    const existingColumns = tableInfo.map(col => col.name);
    
    // Add columns for tracking re-check attempts only if they don't exist
    if (!existingColumns.includes('failure_count')) {
        await db.run(`
            ALTER TABLE user_images ADD COLUMN failure_count INTEGER DEFAULT 0;
        `);
    }
    
    if (!existingColumns.includes('first_failure_at')) {
        await db.run(`
            ALTER TABLE user_images ADD COLUMN first_failure_at INTEGER;
        `);
    }
    
    if (!existingColumns.includes('last_check_at')) {
        await db.run(`
            ALTER TABLE user_images ADD COLUMN last_check_at INTEGER;
        `);
    }
    
    if (!existingColumns.includes('next_check_at')) {
        await db.run(`
            ALTER TABLE user_images ADD COLUMN next_check_at INTEGER;
        `);
    }
    
    if (!existingColumns.includes('recheck_count')) {
        await db.run(`
            ALTER TABLE user_images ADD COLUMN recheck_count INTEGER DEFAULT 0;
        `);
    }
    
    // Create index for efficient querying of images due for re-check
    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_images_next_check 
        ON user_images(next_check_at) 
        WHERE is_active = 0 AND next_check_at IS NOT NULL;
    `);
}

export async function down(db) {
    // SQLite doesn't support dropping columns directly
    // Would need to recreate the table without these columns
    throw new Error('Downgrade not supported - would require table recreation');
}