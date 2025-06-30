# Bong Stats Implementation TODO

## Overview
Complete overhaul of bong statistics to use only real data. No fake data, no placeholders. Sessions are defined as bong records within 2 hours of each other.

## Phase 1: Database Schema Updates

### 1.1 Add hour column to user_bongs
```sql
ALTER TABLE user_bongs ADD COLUMN hour INTEGER;
```

### 1.2 Create bong_sessions table
```sql
CREATE TABLE bong_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    session_start INTEGER NOT NULL,
    session_end INTEGER NOT NULL,
    cone_count INTEGER NOT NULL,
    max_cones_per_hour REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, session_start)
);

CREATE INDEX idx_bong_sessions_username ON bong_sessions(username);
CREATE INDEX idx_bong_sessions_start ON bong_sessions(session_start);
```

### 1.3 Create user_bong_streaks table
```sql
CREATE TABLE user_bong_streaks (
    username TEXT PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_bong_date TEXT,
    streak_start_date TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Phase 2: Data Migration & Backfill

### 2.1 Populate hour column for all existing records
```sql
UPDATE user_bongs 
SET hour = CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch', '+10 hours')) AS INTEGER);
```

### 2.2 Build sessions from historical data
- Iterate through all users with bong records
- For each user, group bongs by 2-hour windows
- Calculate session metrics (start, end, count, max rate)
- Insert into bong_sessions table

### 2.3 Calculate streak data
- For each user, iterate through their bong days
- Calculate current and longest streaks
- Populate user_bong_streaks table

## Phase 3: Update Bong Command

### 3.1 Modify !bong command to:
- Continue inserting into user_bongs with hour field
- Check if this bong extends an existing session or starts a new one
- Update bong_sessions in real-time
- Update user_bong_streaks (check if streak continues or breaks)

## Phase 4: API Endpoint Updates

### 4.1 Modify /api/v1/stats/users/:username/category/bongs to return:
```javascript
{
  // Core stats (existing)
  basicStats: { /* existing user_stats data */ },
  dailyStats: [ /* existing daily counts */ ],
  avgPerDay: number,
  
  // New real data
  timePatterns: {
    hourly: [
      { hour: 0, count: 123, percentage: 5.2 },
      // ... for all 24 hours
    ],
    morning: { count: 234, percentage: 25.1 },   // 6am-12pm
    afternoon: { count: 345, percentage: 37.0 }, // 12pm-6pm
    evening: { count: 234, percentage: 25.1 },   // 6pm-12am
    night: { count: 119, percentage: 12.8 }      // 12am-6am
  },
  
  sessions: {
    total: 156,
    averageConesPerSession: 4.5,
    longestSession: {
      date: "2024-03-15",
      startTime: "14:30",
      duration: 7200000, // ms
      coneCount: 23
    },
    biggestSession: {
      date: "2024-04-20",
      coneCount: 42
    },
    fastestRate: {
      date: "2024-05-01",
      conesPerHour: 12.5,
      sessionCones: 25
    }
  },
  
  streaks: {
    current: 5,
    longest: 42,
    currentStartDate: "2024-06-25",
    longestStartDate: "2024-01-01",
    longestEndDate: "2024-02-11"
  },
  
  records: {
    recordDay: {
      date: "2024-04-20",
      count: 69
    },
    weeklyPeak: {
      weekStart: "2024-04-14",
      count: 420
    },
    totalCones: 1337,
    daysActive: 180
  }
}
```

## Phase 5: Frontend Updates

### 5.1 Update renderBongStats function to:
- Remove all hardcoded percentages for time patterns
- Use real hourly data from API
- Remove tolerance tracking section entirely
- Remove social stats section entirely
- Update session records to use real data
- Add new metrics if needed based on what we can actually track

### 5.2 Sections to address:
1. **Cone Statistics** - Keep as is (already real)
2. **Time Patterns** - Update to use real hourly data
3. **Session Records** - Update to use real session data:
   - Fastest Session (real cones/hour from sessions)
   - Longest Streak (real consecutive days)
   - Biggest Session (real max cones in a session)
   - Weekly Peak (real max day in past 7 days)
4. **Tolerance Tracking** - REMOVE ENTIRELY
5. **Social Stats** - REMOVE ENTIRELY
6. **Consumption Timeline** - Keep but ensure it uses real data

## Phase 6: Batch Jobs

### 6.1 Create new batch job for session analysis
- Run hourly to update recent sessions
- Detect session boundaries
- Update session statistics

### 6.2 Create streak calculator batch job
- Run daily at midnight UTC+10
- Update all user streaks
- Handle streak breaks

## Phase 7: Testing & Validation

### 7.1 Verify data integrity
- Ensure all historical hours are correctly calculated for UTC+10
- Validate session groupings make sense
- Check streak calculations are accurate

### 7.2 Performance testing
- Ensure new queries are optimized
- Add appropriate indexes
- Test with users who have thousands of bong records

## Questions/Decisions Needed:

1. **Session Duration Display**: Since we don't track when each individual bong happened within a session (just the command timestamp), how should we display session duration? 
   - Option A: Show as "Session from 2:30pm to 4:15pm" based on first/last timestamp
   - Option B: Don't show duration at all, just cone count

2. **Empty Time Periods**: If a user has never smoked during certain hours (e.g., 3am-5am), should we:
   - Show 0% for those hours
   - Hide hours with no activity
   - Show a heatmap-style visualization

3. **Weekly Peak Calculation**: 
   - Past 7 days rolling window?
   - Last calendar week (Mon-Sun)?
   - Best 7-day period ever?

4. **Missing Metrics**: The current UI shows "Time Since Last" in tolerance section. Should we:
   - Add a "last bong timestamp" to the API response?
   - Calculate it client-side from most recent daily stat?
   - Remove this metric entirely?

## Implementation Order:
1. Database schema updates
2. Data migration scripts
3. Update !bong command
4. Create batch jobs
5. Update API endpoints
6. Update frontend
7. Testing and validation

## Estimated Timeline:
- Database & Migration: 2-3 hours
- Command Updates: 1 hour
- Batch Jobs: 2 hours
- API Updates: 2 hours
- Frontend Updates: 3-4 hours
- Testing: 2 hours

Total: ~12-15 hours of implementation