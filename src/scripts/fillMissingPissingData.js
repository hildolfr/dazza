#!/usr/bin/env node

import Database from '../services/database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomCharacteristic } from '../modules/pissing_contest/characteristics.js';
import { getRandomLocation } from '../modules/pissing_contest/locations.js';
import { getRandomWeather, formatWeather } from '../modules/pissing_contest/weather.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../cytube_stats_modular.db');

async function fillMissingPissingData() {
    const db = new Database(DB_PATH);
    
    try {
        await db.init();
        console.log('Connected to database');
        
        // Get all matches with missing data
        const matchesWithMissing = await db.all(`
            SELECT id, challenger, challenged, 
                   challenger_characteristic, challenged_characteristic,
                   location, weather
            FROM pissing_contest_challenges
            WHERE challenger_characteristic IS NULL 
               OR challenged_characteristic IS NULL
               OR location IS NULL
               OR weather IS NULL
        `);
        
        console.log(`Found ${matchesWithMissing.length} matches with missing data`);
        
        for (const match of matchesWithMissing) {
            const updates = [];
            const params = [];
            
            // Fill missing challenger characteristic
            if (!match.challenger_characteristic) {
                const char = getRandomCharacteristic();
                updates.push('challenger_characteristic = ?');
                params.push(char.name);
                console.log(`  Match ${match.id}: Adding challenger characteristic: ${char.name}`);
            }
            
            // Fill missing challenged characteristic
            if (!match.challenged_characteristic) {
                const char = getRandomCharacteristic();
                updates.push('challenged_characteristic = ?');
                params.push(char.name);
                console.log(`  Match ${match.id}: Adding challenged characteristic: ${char.name}`);
            }
            
            // Fill missing location
            if (!match.location) {
                const loc = getRandomLocation();
                updates.push('location = ?');
                params.push(loc.name);
                console.log(`  Match ${match.id}: Adding location: ${loc.name}`);
            }
            
            // Fill missing weather
            if (!match.weather) {
                const weather = getRandomWeather();
                const weatherStr = formatWeather(weather);
                updates.push('weather = ?');
                params.push(weatherStr);
                console.log(`  Match ${match.id}: Adding weather: ${weatherStr}`);
            }
            
            // Update the match if we have updates
            if (updates.length > 0) {
                params.push(match.id);
                await db.run(`
                    UPDATE pissing_contest_challenges
                    SET ${updates.join(', ')}
                    WHERE id = ?
                `, params);
            }
        }
        
        console.log('Finished filling missing data');
        
        // Now re-run analytics update to refresh rarest/favorite calculations
        console.log('\nUpdating analytics with new data...');
        
        const users = await db.all(`
            SELECT DISTINCT username FROM (
                SELECT LOWER(challenger) as username FROM pissing_contest_challenges
                UNION
                SELECT LOWER(challenged) as username FROM pissing_contest_challenges
            )
        `);
        
        for (const user of users) {
            const username = user.username;
            
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
                
                console.log(`Updated ${username}: Rarest='${rarestChar?.characteristic}', Favorite='${favoriteLocation?.location}'`);
            }
        }
        
        console.log('\nData filling complete!');
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run the script
fillMissingPissingData();