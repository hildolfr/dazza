export const name = '2025-07-01-add-video-room-support';

export async function up(db, logger = console) {
        // Add room_id to video_sessions table if it doesn't exist
        const videoSessionsInfo = await db.all(`PRAGMA table_info(video_sessions)`);
        const hasRoomId = videoSessionsInfo.some(col => col.name === 'room_id');
        
        if (!hasRoomId) {
            await db.run(`ALTER TABLE video_sessions ADD COLUMN room_id TEXT DEFAULT 'default'`);
            logger.info('Added room_id column to video_sessions table');
            
            // Create index for room_id
            await db.run('CREATE INDEX IF NOT EXISTS idx_video_sessions_room_id ON video_sessions(room_id)');
            logger.info('Created index on video_sessions.room_id');
        }
}

export async function down(db, logger = console) {
    // Note: SQLite doesn't support dropping columns easily
    // This would require recreating the table
    logger.info('Downgrade not implemented - would require table recreation');
}