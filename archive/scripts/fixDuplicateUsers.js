import Database from '../services/database.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixDuplicateUsers() {
    const db = new Database(path.join(__dirname, '../../cytube_stats_modular.db'));
    
    try {
        await db.init();
        console.log('Connected to database');
        
        // Find all duplicate users (same name, different case)
        const duplicates = await db.all(`
            SELECT 
                e1.username as username1,
                e1.balance as balance1,
                e1.trust as trust1,
                e2.username as username2,
                e2.balance as balance2,
                e2.trust as trust2
            FROM user_economy e1
            JOIN user_economy e2 ON LOWER(e1.username) = LOWER(e2.username)
            WHERE e1.username != e2.username
            ORDER BY LOWER(e1.username)
        `);
        
        if (duplicates.length === 0) {
            console.log('No duplicate users found!');
            return;
        }
        
        console.log(`Found ${duplicates.length / 2} pairs of duplicate users:`);
        
        // Process duplicates
        const processed = new Set();
        
        for (const dup of duplicates) {
            const key = [dup.username1, dup.username2].sort().join('|');
            if (processed.has(key)) continue;
            processed.add(key);
            
            console.log(`\nDuplicate found:`);
            console.log(`  ${dup.username1}: $${dup.balance1} (trust: ${dup.trust1})`);
            console.log(`  ${dup.username2}: $${dup.balance2} (trust: ${dup.trust2})`);
            
            // Determine which username to keep (prefer the one with capital letters)
            let keepUsername, removeUsername;
            if (dup.username1.match(/[A-Z]/)) {
                keepUsername = dup.username1;
                removeUsername = dup.username2;
            } else if (dup.username2.match(/[A-Z]/)) {
                keepUsername = dup.username2;
                removeUsername = dup.username1;
            } else {
                // If neither has capitals, keep the one with more activity
                const activity1 = await db.get('SELECT COUNT(*) as count FROM messages WHERE username = ?', [dup.username1]);
                const activity2 = await db.get('SELECT COUNT(*) as count FROM messages WHERE username = ?', [dup.username2]);
                
                if (activity1.count >= activity2.count) {
                    keepUsername = dup.username1;
                    removeUsername = dup.username2;
                } else {
                    keepUsername = dup.username2;
                    removeUsername = dup.username1;
                }
            }
            
            // Get both records
            const keepRecord = await db.get('SELECT * FROM user_economy WHERE username = ?', [keepUsername]);
            const removeRecord = await db.get('SELECT * FROM user_economy WHERE username = ?', [removeUsername]);
            
            // Merge the records
            const mergedBalance = keepRecord.balance + removeRecord.balance;
            const mergedTrust = Math.max(keepRecord.trust, removeRecord.trust);
            const mergedEarned = keepRecord.total_earned + removeRecord.total_earned;
            const mergedHeists = keepRecord.heists_participated + removeRecord.heists_participated;
            
            console.log(`  Merging into ${keepUsername}:`);
            console.log(`    Balance: $${keepRecord.balance} + $${removeRecord.balance} = $${mergedBalance}`);
            console.log(`    Trust: ${mergedTrust} (keeping higher)`);
            
            // Update the record we're keeping
            await db.run(`
                UPDATE user_economy 
                SET balance = ?,
                    trust = ?,
                    total_earned = ?,
                    heists_participated = ?,
                    updated_at = ?
                WHERE username = ?
            `, [mergedBalance, mergedTrust, mergedEarned, mergedHeists, Date.now(), keepUsername]);
            
            // Delete the duplicate
            await db.run('DELETE FROM user_economy WHERE username = ?', [removeUsername]);
            
            console.log(`  ✓ Merged and deleted ${removeUsername}`);
        }
        
        console.log('\nDuplicate user cleanup complete!');
        
        // Show Spazztik's final balance
        const spazztik = await db.get('SELECT * FROM user_economy WHERE LOWER(username) = LOWER(?)', ['Spazztik']);
        if (spazztik) {
            console.log(`\nSpazztik's final balance: $${spazztik.balance} (trust: ${spazztik.trust})`);
        }
        
    } catch (error) {
        console.error('Error fixing duplicate users:', error);
    } finally {
        await db.close();
    }
}

// Run the fix
fixDuplicateUsers();