# Pissing Contest Implementation Specification

## Command Structure
- Primary: `!piss <amount> <username>`
- Aliases: `!pissing_contest <amount> <username>`
- If no amount specified: `!piss <username>` = $0 bragging rights match
- 5 minute cooldown between matches
- Public only (no PM support)

## Database Schema

### pissing_contest_challenges
```sql
CREATE TABLE pissing_contest_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger TEXT NOT NULL,
    challenged TEXT NOT NULL,
    amount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    challenger_characteristic TEXT,
    challenged_characteristic TEXT,
    location TEXT,
    weather TEXT,
    created_at INTEGER NOT NULL,
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
    challenged_total INTEGER
);
```

### pissing_contest_stats
```sql
CREATE TABLE pissing_contest_stats (
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
```

### user_bladder
```sql
CREATE TABLE user_bladder (
    username TEXT PRIMARY KEY,
    current_amount INTEGER DEFAULT 0,
    last_drink_time INTEGER,
    drinks_since_piss TEXT DEFAULT '[]',
    last_piss_time INTEGER,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
);
```

### pissing_contest_records
```sql
CREATE TABLE pissing_contest_records (
    record_type TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    value REAL NOT NULL,
    characteristic TEXT,
    location TEXT,
    achieved_at INTEGER NOT NULL
);
```

## Accept/Decline Phrases

### Accept Phrases
- "yes", "yeah", "yep", "sure", "ok", "okay"
- "bring it on", "you're on", "let's go", "fuck yeah"
- "whip it out", "dicks out", "let's piss"
- "prepare to lose", "easy money", "bet"

### Decline Phrases
- "no", "nah", "nope", "pass"
- "fuck off", "piss off", "not now"
- "maybe later", "busy", "can't"

## Game Flow

### 1. Challenge Phase
- Player issues challenge: `!piss 100 @opponent`
- 30 second timeout for response
- On timeout: refund challenger, mock them for being stood up

### 2. Acceptance Phase (3 seconds)
- Opponent accepts with valid phrase
- Brief acknowledgment: "it's on!" or "dicks out boys!"

### 3. Announcement Phase
- Announce matchup with characteristics
- Announce location and weather
- Build hype with varied formats

Example announcements:
- "🚨 PISSING CONTEST ALERT 🚨 -Player1 'The Horse Cock' vs -Player2 'Pencil Dick' at the servo sideyard!"
- "Oi cunts! -Player1 'The Intimidator' squares off against -Player2 'Baby Carrot' behind the bottlo!"
- "LEGENDARY MATCHUP: -Player1 'Fire Hose Frank' faces -Player2 'The Dripper' at bunnings bog!"

### 4. Contest Phase (30 seconds)
- Display "unzipping" messages
- Rotate through various waiting messages every 5-6 seconds

Waiting messages:
- "*unzipping sounds*"
- "*water hitting pavement*"
- "*aggressive grunting*"
- "I can hear the streams from here..."
- "Someone's having stage fright..."
- "*zipper stuck*"
- "This is taking forever..."
- "*whistling nervously*"
- "Shazza's gonna be pissed about this..."

### 5. Results Phase
- Calculate all modifiers
- Display scores: "📏3.2m 💧850mL 🎯75% ⏱️12s **[725]**"
- Announce winner: "Hildolfr, 'The Horse Dick', is the winner at 725 points!"
- Add contextual commentary

## Scoring Calculation

### Base Ranges
- Distance: 0.5m - 5m
- Volume: 200mL - 2000mL  
- Aim: 10% - 100%
- Duration: 2s - 30s

### Score Formula
```
Total = (Distance × 0.4) + (Volume × 0.25) + (Aim × 0.2) + (Duration × 0.15)
```

### Bladder Modifiers
- 0 drinks: -50% volume, -20% distance
- Per drink: +2% duration, +1% volume (max +100% volume at 100 drinks)

### Tie Breaking
1. Highest distance wins
2. If distance tied, check characteristic rarity
3. Mock both players for identical streams

## Beer Command Integration

Add flavor text to !beer when bladder >= 5:
- 5-10: "bladder's getting full mate"
- 11-15: "gonna need to drain the snake soon"
- 16-20: "bout to piss meself"
- 21-30: "bladder's fuller than a tick"
- 31+: "one sneeze away from disaster"

## Leaderboard (!top pissers)

Display format:
```
🏆 TOP PISSERS 🏆
1. Player1 - 45W/12L - "Fire Hose" (5.8m record) - Rarest: 'The Legend'
2. Player2 - 38W/20L - "Sniper" (98% aim) - Rarest: 'Laser Dick'
3. Player3 - 30W/15L - "Marathon Man" (45s) - Rarest: 'The Monster'
```

## Failed Starts

### With Bet
- Challenger loses bet to opponent
- "Player1 couldn't get it up! Player2 wins $100!"
- "Performance anxiety costs Player1 $100!"

### Bragging Rights ($0)
- Pure mockery: "Player1's dick broke! What a pussy!"
- "All talk, no stream! Player1 forfeits!"
- "Player1 sat down to pee instead!"

## Commentary Examples

### Size Mismatches
- Horse vs Pencil: "David vs Goliath of dicks!"
- Monster vs Acorn: "Like a firehose vs an eyedropper"

### Performance Based
- High distance, low volume: "All pressure, no juice"
- Long duration, low distance: "Dribbled for days"
- Perfect aim, shit distance: "Sat down to pee?"

### Location/Weather Combos
- Beach + Hot: "Dehydrated before they started"
- Servo + Cold: "Shriveled up like raisins"

## Error Handling
- Database failures: "pissing contest database is fucked"
- Invalid challenges: "can't piss against yaself"
- No money: "ya broke cunt, bet less"
- Cooldown active: "still shaking it off, wait {time}"