#!/usr/bin/env node

/**
 * Script to check for and optionally clean system users from the economy database
 */

import Database from '../services/database.js';
import { createLogger } from '../utils/logger.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('CleanSystemUsers');

// Helper to identify system users
function isSystemUser(username) {
    // Check if username matches system user patterns
    if (username.startsWith('[') && username.endsWith(']')) {
        return true;
    }
    
    // Additional known system users
    const systemUsers = ['server', '[server]', '[voteskip]', '[playlist]', '[drink]'];
    return systemUsers.includes(username.toLowerCase());
}

async function main() {
    const dbPath = resolve(__dirname, '../../cytube_stats_modular.db');
    const db = new Database(dbPath);
    
    try {
        await db.connect();
        logger.info('Connected to database');
        
        // Check user_economy table for system users
        const economyUsers = await db.all(`
            SELECT username, balance, trust, total_earned, heists_participated 
            FROM user_economy 
            ORDER BY username
        `);
        
        const systemUsersInEconomy = economyUsers.filter(user => isSystemUser(user.username));
        
        if (systemUsersInEconomy.length === 0) {
            logger.info('No system users found in user_economy table');
        } else {
            logger.warn(`Found ${systemUsersInEconomy.length} system users in economy:`);
            systemUsersInEconomy.forEach(user => {
                logger.info(`  - ${user.username}: balance=${user.balance}, trust=${user.trust}, earned=${user.total_earned}, heists=${user.heists_participated}`);
            });
            
            // Check if running with --clean flag
            if (process.argv.includes('--clean')) {
                logger.info('Cleaning system users from economy...');
                
                await db.run('BEGIN TRANSACTION');
                
                for (const user of systemUsersInEconomy) {
                    // Delete from user_economy
                    await db.run('DELETE FROM user_economy WHERE username = ?', [user.username]);
                    logger.info(`  - Removed ${user.username} from user_economy`);
                    
                    // Also delete any related transactions
                    const result = await db.run('DELETE FROM economy_transactions WHERE username = ?', [user.username]);
                    if (result.changes > 0) {
                        logger.info(`  - Removed ${result.changes} transactions for ${user.username}`);
                    }
                    
                    // Delete from heist_participants
                    const heistResult = await db.run('DELETE FROM heist_participants WHERE username = ?', [user.username]);
                    if (heistResult.changes > 0) {
                        logger.info(`  - Removed ${heistResult.changes} heist participations for ${user.username}`);
                    }
                }
                
                await db.run('COMMIT');
                logger.info('Successfully cleaned system users from economy');
            } else {
                logger.info('To remove these users, run with --clean flag');
            }
        }
        
        // Check recent heist participants
        const recentParticipants = await db.all(`
            SELECT DISTINCT username 
            FROM heist_participants 
            WHERE participated_at > ?
            ORDER BY username
        `, [Date.now() - 7 * 24 * 60 * 60 * 1000]); // Last 7 days
        
        const systemParticipants = recentParticipants.filter(p => isSystemUser(p.username));
        if (systemParticipants.length > 0) {
            logger.warn(`Found ${systemParticipants.length} system users in recent heist participants:`);
            systemParticipants.forEach(p => {
                logger.info(`  - ${p.username}`);
            });
        }
        
    } catch (error) {
        logger.error('Error:', error);
        await db.run('ROLLBACK');
    } finally {
        await db.close();
    }
}

main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});