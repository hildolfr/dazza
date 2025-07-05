-- Migration: Add Economy System Tables
-- Description: Adds all required tables for full economy system functionality
-- Date: 2025-07-05
-- Session: 10

-- Core Economy Table
CREATE TABLE IF NOT EXISTS user_economy (
    username TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0 CHECK (balance >= 0),
    trust INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
    total_lost INTEGER DEFAULT 0 CHECK (total_lost >= 0),
    heists_participated INTEGER DEFAULT 0 CHECK (heists_participated >= 0),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    trust_score INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_economy_trust ON user_economy(trust);
CREATE INDEX IF NOT EXISTS idx_user_economy_balance ON user_economy(balance);

-- Economy Transaction History
CREATE TABLE IF NOT EXISTS economy_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    amount INTEGER NOT NULL,
    trust_change INTEGER DEFAULT 0,
    transaction_type TEXT NOT NULL,
    heist_id INTEGER,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    room_id TEXT NOT NULL DEFAULT 'fatpizza',
    FOREIGN KEY (heist_id) REFERENCES heist_events(id)
);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_username ON economy_transactions(username);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_heist ON economy_transactions(heist_id);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_type ON economy_transactions(transaction_type);

-- Heist Events
CREATE TABLE IF NOT EXISTS heist_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state TEXT NOT NULL,
    crime_type TEXT,
    announced_at INTEGER,
    departed_at INTEGER,
    returned_at INTEGER,
    completed_at INTEGER,
    total_haul INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT 1,
    participants_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    room_id TEXT NOT NULL DEFAULT 'fatpizza',
    status TEXT,
    participant_count INTEGER DEFAULT 0,
    total_payout INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_heist_events_state ON heist_events(state);
CREATE INDEX IF NOT EXISTS idx_heist_events_room_id ON heist_events(room_id);
CREATE INDEX IF NOT EXISTS idx_heist_events_status ON heist_events(status);

-- Heist Participants
CREATE TABLE IF NOT EXISTS heist_participants (
    heist_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    vote TEXT,
    money_earned INTEGER DEFAULT 0,
    trust_gained INTEGER DEFAULT 0,
    participated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (heist_id, username),
    FOREIGN KEY (heist_id) REFERENCES heist_events(id)
);
CREATE INDEX IF NOT EXISTS idx_heist_participants_username ON heist_participants(username);

-- Heist Configuration
CREATE TABLE IF NOT EXISTS heist_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- User Trust System
CREATE TABLE IF NOT EXISTS user_trust (
    username TEXT PRIMARY KEY,
    trust_score INTEGER DEFAULT 0,
    last_update INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Video Session Tracking
CREATE TABLE IF NOT EXISTS video_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id TEXT,
    media_title TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    room_id TEXT DEFAULT 'fatpizza'
);
CREATE INDEX IF NOT EXISTS idx_video_sessions_start_time ON video_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_video_sessions_room_id ON video_sessions(room_id);

-- Video Payout Queue
CREATE TABLE IF NOT EXISTS video_payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    video_id TEXT NOT NULL,
    payout_amount INTEGER NOT NULL,
    queued_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    processed_at INTEGER,
    status TEXT DEFAULT 'queued',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_payouts_username ON video_payouts(username);
CREATE INDEX IF NOT EXISTS idx_video_payouts_video_id ON video_payouts(video_id);
CREATE INDEX IF NOT EXISTS idx_video_payouts_queued ON video_payouts(status, queued_at);
CREATE INDEX IF NOT EXISTS idx_video_payouts_timestamp ON video_payouts(created_at);

-- Video Session Watchers
CREATE TABLE IF NOT EXISTS video_watchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    join_time INTEGER NOT NULL,
    leave_time INTEGER,
    rewarded INTEGER DEFAULT 0,
    reward_amount INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES video_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_video_watchers_session_id ON video_watchers(session_id);
CREATE INDEX IF NOT EXISTS idx_video_watchers_username ON video_watchers(username);
CREATE INDEX IF NOT EXISTS idx_video_watchers_rewarded ON video_watchers(rewarded);

-- Pissing Contest Challenges
CREATE TABLE IF NOT EXISTS pissing_contest_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger TEXT NOT NULL,
    challenged TEXT NOT NULL,
    amount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    challenger_characteristic TEXT,
    challenged_characteristic TEXT,
    location TEXT,
    weather TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    expires_at INTEGER NOT NULL,
    completed_at INTEGER,
    winner TEXT,
    challenger_distance REAL,
    challenger_volume REAL,
    challenger_aim REAL,
    challenger_duration REAL,
    challenger_total INTEGER,
    challenged_distance REAL,
    challenged_volume REAL,
    challenged_aim REAL,
    challenged_duration REAL,
    challenged_total INTEGER,
    room_id TEXT NOT NULL DEFAULT 'fatpizza'
);
CREATE INDEX IF NOT EXISTS idx_pissing_challenges_status ON pissing_contest_challenges(status);
CREATE INDEX IF NOT EXISTS idx_pissing_challenges_challenger ON pissing_contest_challenges(challenger);
CREATE INDEX IF NOT EXISTS idx_pissing_challenges_challenged ON pissing_contest_challenges(challenged);
CREATE INDEX IF NOT EXISTS idx_pissing_contest_challenges_room ON pissing_contest_challenges(room_id);

-- Pissing Contest Statistics
CREATE TABLE IF NOT EXISTS pissing_contest_stats (
    username TEXT PRIMARY KEY,
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    money_won INTEGER DEFAULT 0,
    money_lost INTEGER DEFAULT 0,
    best_distance REAL DEFAULT 0,
    best_volume REAL DEFAULT 0,
    best_aim REAL DEFAULT 0,
    best_duration REAL DEFAULT 0,
    avg_distance REAL DEFAULT 0,
    avg_volume REAL DEFAULT 0,
    avg_aim REAL DEFAULT 0,
    avg_duration REAL DEFAULT 0,
    rarest_characteristic TEXT,
    favorite_location TEXT,
    biggest_upset_win TEXT,
    last_played INTEGER,
    legendary_performances TEXT
);
CREATE INDEX IF NOT EXISTS idx_pissing_stats_wins ON pissing_contest_stats(wins);
CREATE INDEX IF NOT EXISTS idx_pissing_stats_money_won ON pissing_contest_stats(money_won);

-- Pissing Contest Records
CREATE TABLE IF NOT EXISTS pissing_contest_records (
    record_type TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    value REAL NOT NULL,
    characteristic TEXT,
    location TEXT,
    achieved_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- User Bladder State
CREATE TABLE IF NOT EXISTS user_bladder (
    username TEXT NOT NULL,
    room_id TEXT NOT NULL DEFAULT 'fatpizza',
    current_amount INTEGER DEFAULT 0,
    last_drink_time INTEGER,
    drinks_since_piss TEXT DEFAULT '[]',
    last_piss_time INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (username, room_id)
);
CREATE INDEX IF NOT EXISTS idx_user_bladder_username ON user_bladder(username);
CREATE INDEX IF NOT EXISTS idx_user_bladder_room_id ON user_bladder(room_id);

-- Coin Flip Challenges
CREATE TABLE IF NOT EXISTS coin_flip_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger TEXT NOT NULL,
    challenged TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    challenger_choice TEXT,
    challenged_choice TEXT,
    result TEXT,
    winner TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    resolved_at INTEGER,
    expires_at INTEGER NOT NULL,
    room_id TEXT NOT NULL DEFAULT 'fatpizza'
);
CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_status ON coin_flip_challenges(status);
CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_challenger ON coin_flip_challenges(challenger);
CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_challenged ON coin_flip_challenges(challenged);
CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_expires ON coin_flip_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_room ON coin_flip_challenges(room_id);

-- Coin Flip Statistics
CREATE TABLE IF NOT EXISTS coin_flip_stats (
    username TEXT PRIMARY KEY,
    total_flips INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    money_won INTEGER DEFAULT 0,
    money_lost INTEGER DEFAULT 0,
    biggest_win INTEGER DEFAULT 0,
    biggest_loss INTEGER DEFAULT 0,
    heads_chosen INTEGER DEFAULT 0,
    tails_chosen INTEGER DEFAULT 0,
    last_played INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sign Spinning Job Statistics
CREATE TABLE IF NOT EXISTS sign_spinning_stats (
    username TEXT NOT NULL,
    room_id TEXT NOT NULL DEFAULT 'fatpizza',
    total_spins INTEGER DEFAULT 0,
    total_earnings INTEGER DEFAULT 0,
    cars_hit INTEGER DEFAULT 0,
    cops_called INTEGER DEFAULT 0,
    best_shift INTEGER DEFAULT 0,
    worst_shift INTEGER DEFAULT 0,
    perfect_days INTEGER DEFAULT 0,
    last_played INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, room_id)
);
CREATE INDEX IF NOT EXISTS idx_sign_spinning_last_played ON sign_spinning_stats(last_played);
CREATE INDEX IF NOT EXISTS idx_sign_spinning_room ON sign_spinning_stats(room_id);

-- Enhanced Bong Session Tracking
CREATE TABLE IF NOT EXISTS bong_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    session_start INTEGER NOT NULL,
    session_end INTEGER NOT NULL,
    cone_count INTEGER NOT NULL,
    max_cones_per_hour REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, session_start)
);
CREATE INDEX IF NOT EXISTS idx_bong_sessions_username ON bong_sessions(username);
CREATE INDEX IF NOT EXISTS idx_bong_sessions_start ON bong_sessions(session_start);

-- User Bong Streak Tracking
CREATE TABLE IF NOT EXISTS user_bong_streaks (
    username TEXT PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_bong_date TEXT,
    streak_start_date TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing balances to user_economy table
INSERT OR IGNORE INTO user_economy (username, balance, created_at, updated_at)
SELECT username, balance, 
       COALESCE(created_at, strftime('%s', 'now') * 1000),
       COALESCE(updated_at, strftime('%s', 'now') * 1000)
FROM balances;

-- Record migration in migrations table
INSERT OR REPLACE INTO migrations (id, filename, applied_at) 
VALUES (3, '003_economy_system_tables.sql', datetime('now'));