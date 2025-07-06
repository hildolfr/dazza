export const up = async (db) => {
    console.log('Adding hasResponded column to messages table...');
    
    await db.run(`
        ALTER TABLE messages 
        ADD COLUMN hasResponded INTEGER DEFAULT 0
    `);
    
    // Add an index for better performance when querying by hasResponded
    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_messages_hasResponded 
        ON messages(hasResponded)
    `);
    
    console.log('Successfully added hasResponded column to messages table');
};

export const down = async (db) => {
    console.log('Removing hasResponded column from messages table...');
    
    // SQLite doesn't support DROP COLUMN, so we need to recreate the table
    await db.run(`
        CREATE TABLE messages_backup AS 
        SELECT id, username, message, timestamp, created_at, word_count, room_id 
        FROM messages
    `);
    
    await db.run(`DROP TABLE messages`);
    
    await db.run(`
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            word_count INTEGER DEFAULT NULL,
            room_id TEXT NOT NULL DEFAULT 'fatpizza'
        )
    `);
    
    await db.run(`
        INSERT INTO messages (id, username, message, timestamp, created_at, word_count, room_id)
        SELECT id, username, message, timestamp, created_at, word_count, room_id
        FROM messages_backup
    `);
    
    await db.run(`DROP TABLE messages_backup`);
    
    // Recreate indexes
    await db.run('CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
    
    console.log('Successfully removed hasResponded column from messages table');
};