export async function up(db) {
    await db.run(`
        CREATE TABLE IF NOT EXISTS user_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            url TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            pruned_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, url)
        )
    `);

    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_images_username 
        ON user_images(username)
    `);

    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_images_timestamp 
        ON user_images(timestamp)
    `);

    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_user_images_active 
        ON user_images(is_active)
    `);
}

export async function down(db) {
    await db.run('DROP INDEX IF EXISTS idx_user_images_active');
    await db.run('DROP INDEX IF EXISTS idx_user_images_timestamp');
    await db.run('DROP INDEX IF EXISTS idx_user_images_username');
    await db.run('DROP TABLE IF EXISTS user_images');
}