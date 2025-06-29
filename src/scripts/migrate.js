#!/usr/bin/env node

/**
 * Migration CLI
 * 
 * Usage:
 *   npm run migrate          - Run all pending migrations
 *   npm run migrate:status   - Show migration status
 *   npm run migrate:rollback - Rollback last migration
 */

import Database from '../services/database.js';
import MigrationRunner from '../migrations/runner.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../cytube_stats.db');

async function main() {
    const command = process.argv[2] || 'up';
    
    // Initialize database
    const db = new Database(DB_PATH);
    await db.init();
    
    const runner = new MigrationRunner(db);
    
    try {
        switch (command) {
            case 'up':
            case 'run':
                console.log('Running migrations...');
                await runner.runMigrations();
                break;
                
            case 'status':
                await runner.status();
                break;
                
            case 'rollback':
                const steps = parseInt(process.argv[3]) || 1;
                console.log(`Rolling back ${steps} migration(s)...`);
                await runner.rollback(steps);
                break;
                
            default:
                console.log('Unknown command:', command);
                console.log('Available commands: up, status, rollback');
                process.exit(1);
        }
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});