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

### Indexes
- `idx_messages_username` on messages(username)
- `idx_messages_timestamp` on messages(timestamp)
- `idx_user_events_username` on user_events(username)
- `idx_user_events_timestamp` on user_events(timestamp)

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
