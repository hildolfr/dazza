import Database from '../services/database.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * This script normalizes all usernames in the database to use consistent casing.
 * The strategy is to preserve the "canonical" casing (usually the one with proper capitalization)
 * while ensuring all lookups are case-insensitive.
 */

async function normalizeUsernames() {
    const db = new Database(path.join(__dirname, '../../cytube_stats.db'));
    
    try {
        await db.init();
        console.log('Connected to database');
        
        // Step 1: Find all unique usernames across all tables
        console.log('\n=== Step 1: Collecting all unique usernames ===');
        
        const tables = [
            { name: 'user_economy', column: 'username' },
            { name: 'user_stats', column: 'username' },
            { name: 'messages', column: 'username' },
            { name: 'user_events', column: 'username' },
            { name: 'user_bongs', column: 'username' },
            { name: 'posted_urls', column: 'username' },
            { name: 'video_watchers', column: 'username' },
            { name: 'heist_participants', column: 'username' },
            { name: 'economy_transactions', column: 'username' },
            { name: 'tells', column: 'from_user' },
            { name: 'tells', column: 'to_user' },
            { name: 'quotes', column: 'quoted_username' },
            { name: 'quotes', column: 'added_by' }
        ];
        
        // Collect all usernames with their variations
        const usernameCasings = new Map(); // lowercase -> Set of actual casings
        
        for (const table of tables) {
            try {
                const results = await db.all(
                    `SELECT DISTINCT ${table.column} as username FROM ${table.name} WHERE ${table.column} IS NOT NULL`
                );
                
                for (const row of results) {
                    const username = row.username;
                    const lowerUsername = username.toLowerCase();
                    
                    if (!usernameCasings.has(lowerUsername)) {
                        usernameCasings.set(lowerUsername, new Set());
                    }
                    usernameCasings.get(lowerUsername).add(username);
                }
                
                console.log(`Found ${results.length} unique usernames in ${table.name}.${table.column}`);
            } catch (error) {
                console.log(`Table ${table.name} or column ${table.column} doesn't exist, skipping...`);
            }
        }
        
        console.log(`\nTotal unique usernames (case-insensitive): ${usernameCasings.size}`);
        
        // Step 2: Determine canonical casing for each username
        console.log('\n=== Step 2: Determining canonical casing ===');
        
        const canonicalUsernames = new Map(); // lowercase -> canonical casing
        let conflictCount = 0;
        
        for (const [lowerUsername, casings] of usernameCasings) {
            if (casings.size === 1) {
                // Only one casing exists, use it
                canonicalUsernames.set(lowerUsername, Array.from(casings)[0]);
            } else {
                // Multiple casings exist, need to pick the best one
                conflictCount++;
                const casingsArray = Array.from(casings);
                console.log(`\nConflict for "${lowerUsername}": ${casingsArray.join(', ')}`);
                
                // Strategy: Prefer the one with capital letters, or the most common one
                let canonical = casingsArray[0];
                
                // Prefer casing with capital letters (e.g., "Bob" over "bob")
                for (const casing of casingsArray) {
                    if (casing.match(/[A-Z]/)) {
                        canonical = casing;
                        break;
                    }
                }
                
                // Check which casing is most common in messages
                const messageCounts = await Promise.all(
                    casingsArray.map(async (casing) => {
                        const result = await db.get(
                            'SELECT COUNT(*) as count FROM messages WHERE username = ?',
                            [casing]
                        );
                        return { casing, count: result.count };
                    })
                );
                
                // Use the most active casing
                const mostActive = messageCounts.reduce((a, b) => 
                    a.count > b.count ? a : b
                );
                
                if (mostActive.count > 0) {
                    canonical = mostActive.casing;
                }
                
                console.log(`  Chosen canonical: "${canonical}" (${mostActive.count} messages)`);
                canonicalUsernames.set(lowerUsername, canonical);
            }
        }
        
        console.log(`\nFound ${conflictCount} usernames with multiple casings`);
        
        // Step 3: Update all tables to use canonical casing
        console.log('\n=== Step 3: Updating database to use canonical casing ===');
        
        // Begin transaction for safety
        await db.run('BEGIN TRANSACTION');
        
        try {
            for (const table of tables) {
                try {
                    let updateCount = 0;
                    
                    // For each username variation that needs updating
                    for (const [lowerUsername, canonical] of canonicalUsernames) {
                        const casings = usernameCasings.get(lowerUsername);
                        
                        for (const casing of casings) {
                            if (casing !== canonical) {
                                // Update this casing to canonical
                                const result = await db.run(
                                    `UPDATE ${table.name} SET ${table.column} = ? WHERE ${table.column} = ?`,
                                    [canonical, casing]
                                );
                                
                                if (result.changes > 0) {
                                    updateCount += result.changes;
                                }
                            }
                        }
                    }
                    
                    if (updateCount > 0) {
                        console.log(`Updated ${updateCount} rows in ${table.name}.${table.column}`);
                    }
                } catch (error) {
                    console.log(`Skipping ${table.name}.${table.column}: ${error.message}`);
                }
            }
            
            // Step 4: Merge duplicate economy entries
            console.log('\n=== Step 4: Merging duplicate economy entries ===');
            
            const economyDuplicates = await db.all(`
                SELECT 
                    e1.username as username1,
                    e1.balance as balance1,
                    e1.trust as trust1,
                    e2.username as username2,
                    e2.balance as balance2,
                    e2.trust as trust2
                FROM user_economy e1
                JOIN user_economy e2 ON LOWER(e1.username) = LOWER(e2.username)
                WHERE e1.username < e2.username
            `);
            
            console.log(`Found ${economyDuplicates.length} duplicate economy entries to merge`);
            
            for (const dup of economyDuplicates) {
                const canonical = canonicalUsernames.get(dup.username1.toLowerCase());
                const toDelete = canonical === dup.username1 ? dup.username2 : dup.username1;
                
                console.log(`Merging "${toDelete}" into "${canonical}"`);
                
                // Get both records
                const keepRecord = await db.get('SELECT * FROM user_economy WHERE username = ?', [canonical]);
                const deleteRecord = await db.get('SELECT * FROM user_economy WHERE username = ?', [toDelete]);
                
                if (keepRecord && deleteRecord) {
                    // Merge the records
                    const mergedBalance = keepRecord.balance + deleteRecord.balance;
                    const mergedTrust = Math.max(keepRecord.trust, deleteRecord.trust);
                    const mergedEarned = (keepRecord.total_earned || 0) + (deleteRecord.total_earned || 0);
                    const mergedLost = (keepRecord.total_lost || 0) + (deleteRecord.total_lost || 0);
                    const mergedHeists = (keepRecord.heists_participated || 0) + (deleteRecord.heists_participated || 0);
                    
                    // Update the canonical record
                    await db.run(`
                        UPDATE user_economy 
                        SET balance = ?,
                            trust = ?,
                            total_earned = ?,
                            total_lost = ?,
                            heists_participated = ?,
                            updated_at = ?
                        WHERE username = ?
                    `, [mergedBalance, mergedTrust, mergedEarned, mergedLost, mergedHeists, Date.now(), canonical]);
                    
                    // Delete the duplicate
                    await db.run('DELETE FROM user_economy WHERE username = ?', [toDelete]);
                    
                    console.log(`  Merged: balance $${keepRecord.balance} + $${deleteRecord.balance} = $${mergedBalance}`);
                }
            }
            
            // Commit transaction
            await db.run('COMMIT');
            console.log('\n✓ Database normalization complete!');
            
            // Step 5: Verify results
            console.log('\n=== Step 5: Verification ===');
            
            // Check for remaining duplicates
            const remainingDuplicates = await db.all(`
                SELECT COUNT(*) as count, LOWER(username) as lower_username 
                FROM user_economy 
                GROUP BY LOWER(username) 
                HAVING COUNT(*) > 1
            `);
            
            if (remainingDuplicates.length === 0) {
                console.log('✓ No duplicate economy entries remain');
            } else {
                console.log(`⚠ Warning: ${remainingDuplicates.length} duplicate entries still exist`);
            }
            
            // Show some example normalizations
            console.log('\nExample canonical usernames:');
            let exampleCount = 0;
            for (const [lower, canonical] of canonicalUsernames) {
                const casings = usernameCasings.get(lower);
                if (casings.size > 1) {
                    console.log(`  ${Array.from(casings).join(', ')} → ${canonical}`);
                    if (++exampleCount >= 10) break;
                }
            }
            
        } catch (error) {
            console.error('Error during normalization, rolling back:', error);
            await db.run('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error normalizing usernames:', error);
    } finally {
        await db.close();
    }
}

// Run the normalization
normalizeUsernames();