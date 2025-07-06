import Database from '../services/database.js';
import { normalizeUsernameForDb } from '../utils/usernameNormalizer.js';

async function mergeVideoWatchers() {
    const db = new Database('./cytube_stats_modular.db');
    await db.init();
    
    try {
        console.log('Starting video watchers merge...\n');
        
        // Get all unique usernames (case-insensitive)
        const allUsers = await db.all(`
            SELECT DISTINCT LOWER(username) as username_lower
            FROM video_watchers
            ORDER BY username_lower
        `);
        
        console.log(`Found ${allUsers.length} unique users (case-insensitive)\n`);
        
        for (const { username_lower } of allUsers) {
            // Get all case variations for this user
            const variations = await db.all(`
                SELECT DISTINCT username
                FROM video_watchers
                WHERE LOWER(username) = ?
            `, [username_lower]);
            
            if (variations.length > 1) {
                console.log(`\nMerging ${variations.length} variations for ${username_lower}:`);
                variations.forEach(v => console.log(`  - ${v.username}`));
                
                // Get the canonical username - use the first variation as base
                const canonicalUsername = normalizeUsernameForDb(variations[0].username);
                console.log(`  Canonical username: ${canonicalUsername}`);
                
                // Get stats for all variations
                const stats = await db.get(`
                    SELECT 
                        COUNT(*) as total_records,
                        COUNT(DISTINCT session_id) as unique_sessions,
                        SUM(reward_amount) as total_earned,
                        COUNT(CASE WHEN rewarded = 1 THEN 1 END) as times_rewarded,
                        MIN(join_time) as earliest_join,
                        MAX(join_time) as latest_join
                    FROM video_watchers
                    WHERE LOWER(username) = ?
                `, [username_lower]);
                
                console.log(`  Stats before merge:`);
                console.log(`    - Total records: ${stats.total_records}`);
                console.log(`    - Unique sessions: ${stats.unique_sessions}`);
                console.log(`    - Total earned: $${stats.total_earned || 0}`);
                console.log(`    - Times rewarded: ${stats.times_rewarded}`);
                
                // Update all records to use canonical username
                const result = await db.run(`
                    UPDATE video_watchers
                    SET username = ?
                    WHERE LOWER(username) = ? AND username != ?
                `, [canonicalUsername, username_lower, canonicalUsername]);
                
                console.log(`  Updated ${result.changes} records to use canonical username`);
            }
        }
        
        // Now check for any duplicate session entries (same user, same session)
        console.log('\n\nChecking for duplicate session entries...');
        const duplicates = await db.all(`
            SELECT username, session_id, COUNT(*) as count
            FROM video_watchers
            GROUP BY username, session_id
            HAVING COUNT(*) > 1
        `);
        
        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} duplicate session entries to clean up\n`);
            
            for (const dup of duplicates) {
                console.log(`Cleaning duplicates for ${dup.username} in session ${dup.session_id} (${dup.count} entries)`);
                
                // Keep only the earliest entry for each user/session combination
                await db.run(`
                    DELETE FROM video_watchers
                    WHERE username = ? AND session_id = ?
                    AND rowid NOT IN (
                        SELECT MIN(rowid)
                        FROM video_watchers
                        WHERE username = ? AND session_id = ?
                    )
                `, [dup.username, dup.session_id, dup.username, dup.session_id]);
            }
        } else {
            console.log('No duplicate session entries found!');
        }
        
        // Final summary
        console.log('\n\n=== MERGE COMPLETE ===\n');
        
        const finalStats = await db.all(`
            SELECT 
                username,
                COUNT(*) as videos_watched,
                SUM(reward_amount) as total_earned,
                COUNT(CASE WHEN rewarded = 1 THEN 1 END) as times_rewarded
            FROM video_watchers
            WHERE rewarded = 1
            GROUP BY username
            ORDER BY total_earned DESC
        `);
        
        console.log('Top earners after merge:');
        finalStats.slice(0, 10).forEach((user, index) => {
            console.log(`${index + 1}. ${user.username}: $${user.total_earned} from ${user.videos_watched} videos`);
        });
        
    } catch (error) {
        console.error('Error during merge:', error);
    } finally {
        await db.close();
    }
}

// Run the merge
mergeVideoWatchers().catch(console.error);