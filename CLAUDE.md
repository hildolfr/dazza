tha## Project Overview
- We're going to make a chatbot that interfaces with the cytube chatroom at https://cytu.be/r/fatpizza

## Database Schema (SQLite)
The bot uses SQLite database (`cytube_stats.db`) for persistence with the following tables:

### messages
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `username` TEXT NOT NULL
- `message` TEXT NOT NULL
- `timestamp` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### user_events
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `username` TEXT NOT NULL
- `event_type` TEXT NOT NULL (either 'join' or 'leave')
- `timestamp` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### user_stats
- `username` TEXT PRIMARY KEY
- `first_seen` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `last_seen` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `message_count` INTEGER DEFAULT 0
- `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### bong_counter
- `date` TEXT PRIMARY KEY (Date string from toDateString())
- `count` INTEGER DEFAULT 0
- `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### user_bongs
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `username` TEXT NOT NULL
- `timestamp` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### drink_counter
- `date` TEXT PRIMARY KEY (Date string from toDateString())
- `count` INTEGER DEFAULT 0
- `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### user_drinks
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `username` TEXT NOT NULL
- `timestamp` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### user_images
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `username` TEXT NOT NULL
- `url` TEXT NOT NULL
- `timestamp` INTEGER NOT NULL (Unix timestamp in milliseconds)
- `is_active` INTEGER DEFAULT 1 (1 = active, 0 = pruned)
- `pruned_reason` TEXT (reason why image was marked as dead)
- `failure_count` INTEGER DEFAULT 0 (number of consecutive health check failures)
- `first_failure_at` INTEGER (Unix timestamp of first failure)
- `last_check_at` INTEGER (Unix timestamp of last health check)
- `next_check_at` INTEGER (Unix timestamp for next scheduled re-check)
- `recheck_count` INTEGER DEFAULT 0 (number of re-check attempts after pruning)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- UNIQUE(username, url) - prevents duplicate entries
- Note: When a pruned image URL is posted again, it's automatically restored to active status

### user_gallery_locks
- `username` TEXT PRIMARY KEY
- `is_locked` INTEGER DEFAULT 0 (0 = unlocked, 1 = locked)
- `locked_at` INTEGER (Unix timestamp when locked)
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Note: Controls whether images in a user's gallery can be deleted by others

### Indexes
- `idx_messages_username` on messages(username)
- `idx_messages_timestamp` on messages(timestamp)
- `idx_user_events_username` on user_events(username)
- `idx_user_events_timestamp` on user_events(timestamp)
- `idx_user_bongs_username` on user_bongs(username)
- `idx_user_bongs_timestamp` on user_bongs(timestamp)
- `idx_user_drinks_username` on user_drinks(username)
- `idx_user_drinks_timestamp` on user_drinks(timestamp)
- `idx_user_images_username` on user_images(username)
- `idx_user_images_timestamp` on user_images(timestamp)
- `idx_user_images_active` on user_images(is_active)
- `idx_user_images_next_check` on user_images(next_check_at) WHERE is_active = 0 AND next_check_at IS NOT NULL

## Character Design
- The bot should always attempt to act / roleplay like dazza the all australian bogan

## Character Background
- Dazza doesn't deliver pizza, he's just a reoccurring pizza customer on the show
- He's married to shazza
- He hassles his missus for ciggies and smokes like 50 bongs a day
- He's a dole bludging cunt

## Security Notes
- Do NOT hardcode login credentials in source code
- Create a login.txt file for storing credentials and add it to .gitignore to protect sensitive information

## Naming Conventions
- When mentioning user names we will always prepend a - to them in order to avoid triggering a mention unless we explicitly want to do so. ex: Bob becomes -Bob.

## Modularity
- We will always make an effort to keep components modular and compartmentalized. Specifically all new commands should be a specific singular modular within the proper folder.

## Documentation Management
- Keep the help document up to date when adding new commands
- If a new command is implemented, remember to document it in the help resources

## Logging Guidelines
- When told to check logs we will ALWAYS presume to check logs/console_log.txt first. its often the most recent

## Timezone Configuration
- We shall calculate timezones assuming UTC+10, eastern australia. Server time is UTC-8.