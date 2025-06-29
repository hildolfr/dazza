import Database from '../services/database.js';
import { readFileSync } from 'fs';
import { glob } from 'glob';

async function importHistoricalFishing() {
    const db = new Database('./cytube_stats.db');
    await db.init();
    
    try {
        console.log('=== IMPORTING HISTORICAL FISHING DATA ===\n');
        
        // Find all log files
        const logFiles = await glob('logs/cytube-bot-*.log');
        console.log(`Found ${logFiles.length} log files to scan\n`);
        
        const fishingRecords = [];
        
        for (const logFile of logFiles) {
            console.log(`Scanning ${logFile}...`);
            const content = readFileSync(logFile, 'utf-8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Look for fishing PMs
                if (line.includes('[INFO] Sending PM to') && line.includes('Fishing at')) {
                    // Extract username
                    const userMatch = line.match(/Sending PM to (\w+):/);
                    if (!userMatch) continue;
                    
                    const username = userMatch[1];
                    
                    // Look for the catch in the next few lines
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        const catchLine = lines[j];
                        
                        // Match multiple patterns for different catch types
                        let catchMatch = catchLine.match(/([\d.]+)kg ([^!]+)!.*\$(\d+)/);
                        
                        // Also try the legendary catch pattern
                        if (!catchMatch && catchLine.includes('kg') && catchLine.includes('$')) {
                            // Match "You caught a 41.5kg Black Marlin!" followed by "That's worth $280!"
                            const weightMatch = catchLine.match(/caught a ([\d.]+)kg ([^!]+)!/);
                            const valueMatch = lines[j+1]?.match(/worth \$(\d+)/);
                            
                            if (weightMatch && valueMatch) {
                                catchMatch = [null, weightMatch[1], weightMatch[2], valueMatch[1]];
                            }
                        }
                        
                        if (catchMatch) {
                            const weight = parseFloat(catchMatch[1]);
                            const fishType = catchMatch[2].trim();
                            const value = parseInt(catchMatch[3]);
                            
                            // Extract timestamp from the log line
                            const timestampMatch = line.match(/\[([\d-T:.Z]+)\]/);
                            const timestamp = timestampMatch ? new Date(timestampMatch[1]).getTime() : Date.now();
                            
                            fishingRecords.push({
                                username,
                                weight,
                                fishType,
                                value,
                                timestamp
                            });
                            
                            console.log(`  Found: ${username} caught ${weight}kg ${fishType} worth $${value}`);
                            break;
                        }
                    }
                }
            }
        }
        
        console.log(`\n\nFound ${fishingRecords.length} historical fishing records\n`);
        
        if (fishingRecords.length > 0) {
            // Sort by weight to show biggest catches
            fishingRecords.sort((a, b) => b.weight - a.weight);
            
            console.log('Top 10 historical catches:');
            fishingRecords.slice(0, 10).forEach((record, i) => {
                console.log(`${i+1}. ${record.username}: ${record.weight}kg ${record.fishType} ($${record.value})`);
            });
            
            // Import into database
            console.log('\n\nImporting into economy_transactions table...');
            
            let imported = 0;
            for (const record of fishingRecords) {
                try {
                    // Check if this transaction already exists (avoid duplicates)
                    const existing = await db.get(`
                        SELECT id FROM economy_transactions 
                        WHERE username = ? 
                        AND transaction_type = 'fishing'
                        AND description = ?
                        AND created_at = ?
                    `, [record.username, `${record.weight}kg ${record.fishType}`, record.timestamp]);
                    
                    if (!existing) {
                        await db.run(`
                            INSERT INTO economy_transactions 
                            (username, amount, transaction_type, description, created_at)
                            VALUES (?, ?, ?, ?, ?)
                        `, [record.username, record.value, 'fishing', `${record.weight}kg ${record.fishType}`, record.timestamp]);
                        imported++;
                    }
                } catch (error) {
                    console.error(`Failed to import record for ${record.username}:`, error.message);
                }
            }
            
            console.log(`\nSuccessfully imported ${imported} new fishing records!`);
            
            // Test the leaderboard
            console.log('\n\n=== UPDATED FISHING LEADERBOARD ===');
            const topFishers = await db.getTopFishers(10);
            topFishers.forEach((fisher, i) => {
                console.log(`${i+1}. ${fisher.username}: ${fisher.biggest_catch}kg`);
            });
        }
        
    } catch (error) {
        console.error('Error importing fishing data:', error);
    } finally {
        await db.close();
    }
}

// Run the import
importHistoricalFishing().catch(console.error);