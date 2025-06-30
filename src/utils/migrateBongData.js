import Database from '../services/database.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// UTC+10 timezone offset in milliseconds (server is UTC-8, so +18 hours total)
const TIMEZONE_OFFSET = 18 * 60 * 60 * 1000;
const SESSION_GAP = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

async function migrateHistoricalData() {
    const dbPath = join(__dirname, '../../cytube_stats.db');
    const db = new Database(dbPath, 'migration');
    
    try {
        await db.init();
        console.log('Connected to database');
        
        // Step 1: Update hour field for all existing bong records
        console.log('Updating hour field for existing records...');
        await db.run(`
            UPDATE user_bongs 
            SET hour = CAST(strftime('%H', datetime((timestamp + ${TIMEZONE_OFFSET})/1000, 'unixepoch')) AS INTEGER)
            WHERE hour IS NULL
        `);
        
        const hourUpdateCount = await db.get('SELECT changes() as count');
        console.log(`Updated ${hourUpdateCount.count} records with hour data`);
        
        // Step 2: Get all users with bong records
        const users = await db.all(`
            SELECT DISTINCT username 
            FROM user_bongs 
            ORDER BY username
        `);
        
        console.log(`Processing ${users.length} users for session calculation...`);
        
        // Step 3: Calculate sessions for each user
        for (const user of users) {
            await calculateUserSessions(db, user.username);
            await calculateUserStreaks(db, user.username);
        }
        
        console.log('Migration completed successfully!');
        
        // Display some stats
        const sessionCount = await db.get('SELECT COUNT(*) as count FROM bong_sessions');
        const streakCount = await db.get('SELECT COUNT(*) as count FROM user_bong_streaks');
        
        console.log(`\nMigration Summary:`);
        console.log(`- Total sessions created: ${sessionCount.count}`);
        console.log(`- Total users with streaks: ${streakCount.count}`);
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await db.close();
    }
}

async function calculateUserSessions(db, username) {
    // Get all bong records for the user, ordered by timestamp
    const bongs = await db.all(`
        SELECT timestamp 
        FROM user_bongs 
        WHERE username = ?
        ORDER BY timestamp
    `, [username]);
    
    if (bongs.length === 0) return;
    
    const sessions = [];
    let currentSession = {
        start: bongs[0].timestamp,
        end: bongs[0].timestamp,
        cones: 1,
        timestamps: [bongs[0].timestamp]
    };
    
    // Group bongs into sessions
    for (let i = 1; i < bongs.length; i++) {
        const timeSinceLastBong = bongs[i].timestamp - currentSession.end;
        
        if (timeSinceLastBong <= SESSION_GAP) {
            // Continue current session
            currentSession.end = bongs[i].timestamp;
            currentSession.cones++;
            currentSession.timestamps.push(bongs[i].timestamp);
        } else {
            // Calculate max cones per hour for the session
            currentSession.maxConesPerHour = calculateMaxConesPerHour(currentSession.timestamps);
            sessions.push(currentSession);
            
            // Start new session
            currentSession = {
                start: bongs[i].timestamp,
                end: bongs[i].timestamp,
                cones: 1,
                timestamps: [bongs[i].timestamp]
            };
        }
    }
    
    // Don't forget the last session
    currentSession.maxConesPerHour = calculateMaxConesPerHour(currentSession.timestamps);
    sessions.push(currentSession);
    
    // Insert sessions into database
    for (const session of sessions) {
        await db.run(`
            INSERT OR REPLACE INTO bong_sessions 
            (username, session_start, session_end, cone_count, max_cones_per_hour)
            VALUES (?, ?, ?, ?, ?)
        `, [username, session.start, session.end, session.cones, session.maxConesPerHour]);
    }
    
    console.log(`Created ${sessions.length} sessions for ${username}`);
}

function calculateMaxConesPerHour(timestamps) {
    if (timestamps.length <= 1) return timestamps.length;
    
    let maxRate = 0;
    
    // Sliding window of 1 hour
    for (let i = 0; i < timestamps.length; i++) {
        let count = 1;
        const windowStart = timestamps[i];
        const windowEnd = windowStart + (60 * 60 * 1000); // 1 hour later
        
        // Count how many cones fall within this hour window
        for (let j = i + 1; j < timestamps.length && timestamps[j] <= windowEnd; j++) {
            count++;
        }
        
        maxRate = Math.max(maxRate, count);
    }
    
    return maxRate;
}

async function calculateUserStreaks(db, username) {
    // Get all unique dates the user has smoked (in UTC+10)
    const dates = await db.all(`
        SELECT DISTINCT date((timestamp + ${TIMEZONE_OFFSET})/1000, 'unixepoch') as bong_date
        FROM user_bongs
        WHERE username = ?
        ORDER BY bong_date
    `, [username]);
    
    if (dates.length === 0) return;
    
    let currentStreak = 1;
    let longestStreak = 1;
    let streakStart = dates[0].bong_date;
    let currentStreakStart = dates[0].bong_date;
    
    // Calculate streaks
    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1].bong_date);
        const currDate = new Date(dates[i].bong_date);
        const daysDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
            // Consecutive day
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            // Streak broken
            currentStreak = 1;
            currentStreakStart = dates[i].bong_date;
        }
    }
    
    // Check if current streak is still active (last bong was today or yesterday)
    const lastBongDate = new Date(dates[dates.length - 1].bong_date);
    const today = new Date();
    const daysSinceLastBong = Math.floor((today - lastBongDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastBong > 1) {
        currentStreak = 0; // Streak is broken
        currentStreakStart = null;
    }
    
    // Insert or update streak data
    await db.run(`
        INSERT OR REPLACE INTO user_bong_streaks
        (username, current_streak, longest_streak, last_bong_date, streak_start_date)
        VALUES (?, ?, ?, ?, ?)
    `, [username, currentStreak, longestStreak, dates[dates.length - 1].bong_date, currentStreakStart]);
}

// Run the migration
migrateHistoricalData().catch(console.error);