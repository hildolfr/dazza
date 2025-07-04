-- Media tracking database schema
-- Note: This migration applies to the media database, not the main database

-- Media history table
CREATE TABLE IF NOT EXISTS media_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    added_by TEXT,
    room_id TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    play_count INTEGER DEFAULT 1,
    queue_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(url, room_id)
);

-- Create indexes for media history
CREATE INDEX IF NOT EXISTS idx_media_history_url ON media_history(url);
CREATE INDEX IF NOT EXISTS idx_media_history_room ON media_history(room_id);
CREATE INDEX IF NOT EXISTS idx_media_history_added_by ON media_history(added_by);
CREATE INDEX IF NOT EXISTS idx_media_history_last_seen ON media_history(last_seen);