-- Initial schema migration
-- This migration creates the base tables for the Dazza bot

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    room TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User statistics
CREATE TABLE IF NOT EXISTS user_stats (
    username TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User events (joins/leaves)
CREATE TABLE IF NOT EXISTS user_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    room TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Economy system
CREATE TABLE IF NOT EXISTS user_economy (
    username TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 100,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    last_daily INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user TEXT,
    to_user TEXT,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bong counter
CREATE TABLE IF NOT EXISTS bong_counter (
    date TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_bongs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Drink counter
CREATE TABLE IF NOT EXISTS drink_counter (
    date TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User images gallery
CREATE TABLE IF NOT EXISTS user_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    url TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    pruned_reason TEXT,
    failure_count INTEGER DEFAULT 0,
    first_failure_at INTEGER,
    last_check_at INTEGER,
    next_check_at INTEGER,
    recheck_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, url)
);

CREATE TABLE IF NOT EXISTS user_gallery_locks (
    username TEXT PRIMARY KEY,
    is_locked INTEGER DEFAULT 0,
    locked_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);

CREATE INDEX IF NOT EXISTS idx_user_events_username ON user_events(username);
CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON user_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_user);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_user);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_bongs_username ON user_bongs(username);
CREATE INDEX IF NOT EXISTS idx_user_bongs_timestamp ON user_bongs(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_drinks_username ON user_drinks(username);
CREATE INDEX IF NOT EXISTS idx_user_drinks_timestamp ON user_drinks(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_images_username ON user_images(username);
CREATE INDEX IF NOT EXISTS idx_user_images_active ON user_images(is_active);
CREATE INDEX IF NOT EXISTS idx_user_images_next_check ON user_images(next_check_at) 
    WHERE is_active = 0 AND next_check_at IS NOT NULL;