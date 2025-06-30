export async function up(db) {
    await db.run(`
        CREATE TABLE IF NOT EXISTS user_gallery_locks (
            username TEXT PRIMARY KEY,
            is_locked INTEGER DEFAULT 0,
            locked_at INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export async function down(db) {
    await db.run('DROP TABLE IF EXISTS user_gallery_locks');
}