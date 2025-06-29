-- Universal cooldowns table for tracking command usage
CREATE TABLE IF NOT EXISTS command_cooldowns (
    username TEXT NOT NULL,
    command_name TEXT NOT NULL,
    last_used INTEGER NOT NULL, -- Unix timestamp in milliseconds
    PRIMARY KEY (username, command_name)
);

-- Mystery Box statistics
CREATE TABLE IF NOT EXISTS mystery_box_stats (
    username TEXT PRIMARY KEY,
    boxes_opened INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0, -- in cents
    total_won INTEGER DEFAULT 0, -- in cents
    injuries INTEGER DEFAULT 0,
    biggest_win INTEGER DEFAULT 0, -- in cents
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Couch searching statistics
CREATE TABLE IF NOT EXISTS couch_stats (
    username TEXT PRIMARY KEY,
    searches INTEGER DEFAULT 0,
    total_found INTEGER DEFAULT 0, -- in cents
    mishaps INTEGER DEFAULT 0,
    biggest_find INTEGER DEFAULT 0, -- in cents
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coin flip statistics
CREATE TABLE IF NOT EXISTS coin_flip_stats (
    username TEXT PRIMARY KEY,
    flips_won INTEGER DEFAULT 0,
    flips_lost INTEGER DEFAULT 0,
    total_wagered INTEGER DEFAULT 0, -- in cents
    biggest_win INTEGER DEFAULT 0, -- in cents
    pvp_wins INTEGER DEFAULT 0,
    pvp_losses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sign spinning work statistics
CREATE TABLE IF NOT EXISTS sign_spinning_stats (
    username TEXT PRIMARY KEY,
    times_worked INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0, -- in cents
    injuries INTEGER DEFAULT 0,
    best_day INTEGER DEFAULT 0, -- in cents
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mugging statistics
CREATE TABLE IF NOT EXISTS mug_stats (
    username TEXT PRIMARY KEY,
    successful_mugs INTEGER DEFAULT 0,
    failed_mugs INTEGER DEFAULT 0,
    times_mugged INTEGER DEFAULT 0,
    defended_mugs INTEGER DEFAULT 0,
    total_stolen INTEGER DEFAULT 0, -- in cents
    total_lost INTEGER DEFAULT 0, -- in cents
    cops_called INTEGER DEFAULT 0,
    trust_gained INTEGER DEFAULT 0,
    trust_lost INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Active coin flip challenges
CREATE TABLE IF NOT EXISTS coin_flip_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger TEXT NOT NULL,
    challenged TEXT NOT NULL,
    amount INTEGER NOT NULL, -- in cents
    flip_time INTEGER NOT NULL, -- Unix timestamp in milliseconds
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, completed, expired
    winner TEXT, -- NULL until completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Command cooldowns indexes
CREATE INDEX IF NOT EXISTS idx_cooldowns_username ON command_cooldowns(username);
CREATE INDEX IF NOT EXISTS idx_cooldowns_command ON command_cooldowns(command_name);
CREATE INDEX IF NOT EXISTS idx_cooldowns_last_used ON command_cooldowns(last_used);

-- Mystery box indexes
CREATE INDEX IF NOT EXISTS idx_mystery_box_total_won ON mystery_box_stats(total_won);
CREATE INDEX IF NOT EXISTS idx_mystery_box_boxes_opened ON mystery_box_stats(boxes_opened);

-- Couch stats indexes
CREATE INDEX IF NOT EXISTS idx_couch_total_found ON couch_stats(total_found);
CREATE INDEX IF NOT EXISTS idx_couch_searches ON couch_stats(searches);

-- Coin flip indexes
CREATE INDEX IF NOT EXISTS idx_coin_flip_total_wagered ON coin_flip_stats(total_wagered);
CREATE INDEX IF NOT EXISTS idx_coin_flip_pvp_wins ON coin_flip_stats(pvp_wins);

-- Sign spinning indexes
CREATE INDEX IF NOT EXISTS idx_sign_spinning_total_earned ON sign_spinning_stats(total_earned);
CREATE INDEX IF NOT EXISTS idx_sign_spinning_times_worked ON sign_spinning_stats(times_worked);

-- Mug stats indexes
CREATE INDEX IF NOT EXISTS idx_mug_total_stolen ON mug_stats(total_stolen);
CREATE INDEX IF NOT EXISTS idx_mug_successful_mugs ON mug_stats(successful_mugs);

-- Coin flip challenges indexes
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON coin_flip_challenges(challenger);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON coin_flip_challenges(challenged);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON coin_flip_challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_flip_time ON coin_flip_challenges(flip_time);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON coin_flip_challenges(created_at);

-- Composite index for finding active challenges between users
CREATE INDEX IF NOT EXISTS idx_challenges_users_status ON coin_flip_challenges(challenger, challenged, status);

-- Triggers to update the updated_at timestamp automatically

CREATE TRIGGER IF NOT EXISTS update_mystery_box_timestamp
AFTER UPDATE ON mystery_box_stats
BEGIN
    UPDATE mystery_box_stats SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
END;

CREATE TRIGGER IF NOT EXISTS update_couch_timestamp
AFTER UPDATE ON couch_stats
BEGIN
    UPDATE couch_stats SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
END;

CREATE TRIGGER IF NOT EXISTS update_coin_flip_timestamp
AFTER UPDATE ON coin_flip_stats
BEGIN
    UPDATE coin_flip_stats SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
END;

CREATE TRIGGER IF NOT EXISTS update_sign_spinning_timestamp
AFTER UPDATE ON sign_spinning_stats
BEGIN
    UPDATE sign_spinning_stats SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
END;

CREATE TRIGGER IF NOT EXISTS update_mug_timestamp
AFTER UPDATE ON mug_stats
BEGIN
    UPDATE mug_stats SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
END;