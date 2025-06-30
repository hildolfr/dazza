#!/usr/bin/env node

import Database from '../services/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../cytube_stats.db');

async function updateAllPissingAnalytics() {
    const db = new Database(DB_PATH);
    
    try {
        await db.init();
        console.log('Connected to database');
        
        // Get all users who have participated in pissing contests
        const users = await db.all(`
            SELECT DISTINCT username FROM (
                SELECT LOWER(challenger) as username FROM pissing_contest_challenges
                UNION
                SELECT LOWER(challenged) as username FROM pissing_contest_challenges
            )
        `);
        
        console.log(`Found ${users.length} users to update`);
        
        for (const user of users) {
            const username = user.username;
            console.log(`Updating analytics for ${username}...`);
            
            try {
                // Get rarest characteristic used
                const rarestChar = await db.get(`
                    SELECT characteristic, COUNT(*) as usage_count
                    FROM (
                        SELECT challenger_characteristic as characteristic
                        FROM pissing_contest_challenges
                        WHERE LOWER(challenger) = ? AND challenger_characteristic IS NOT NULL
                        UNION ALL
                        SELECT challenged_characteristic as characteristic
                        FROM pissing_contest_challenges
                        WHERE LOWER(challenged) = ? AND challenged_characteristic IS NOT NULL
                    ) combined
                    GROUP BY characteristic
                    ORDER BY usage_count ASC
                    LIMIT 1
                `, [username, username]);
                
                // Get favorite location (most used)
                const favoriteLocation = await db.get(`
                    SELECT location, COUNT(*) as visit_count
                    FROM pissing_contest_challenges
                    WHERE (LOWER(challenger) = ? OR LOWER(challenged) = ?)
                    AND location IS NOT NULL
                    GROUP BY location
                    ORDER BY visit_count DESC
                    LIMIT 1
                `, [username, username]);
                
                // Update the stats with analytics
                if (rarestChar || favoriteLocation) {
                    await db.run(`
                        UPDATE pissing_contest_stats
                        SET rarest_characteristic = COALESCE(?, rarest_characteristic),
                            favorite_location = COALESCE(?, favorite_location)
                        WHERE LOWER(username) = ?
                    `, [rarestChar?.characteristic, favoriteLocation?.location, username]);
                    
                    console.log(`  - Rarest: ${rarestChar?.characteristic || 'none'}`);
                    console.log(`  - Favorite: ${favoriteLocation?.location || 'none'}`);
                }
            } catch (error) {
                console.error(`Error updating ${username}:`, error.message);
            }
        }
        
        console.log('Analytics update complete!');
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run the script
updateAllPissingAnalytics();