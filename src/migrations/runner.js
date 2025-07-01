/**
 * Migration Runner
 * 
 * This utility handles running database migrations in order.
 * Migrations are tracked in a migrations table to ensure they only run once.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MigrationRunner {
    constructor(db) {
        this.db = db;
    }
    
    async initialize() {
        // Create migrations tracking table
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
    
    async getMigrationFiles() {
        console.log(`Looking for migrations in: ${__dirname}`);
        const files = await fs.readdir(__dirname);
        const migrationFiles = files
            .filter(f => f.endsWith('.js') && f !== 'runner.js')
            .sort(); // Sort by filename (which includes date)
        console.log(`Found migration files: ${migrationFiles.join(', ')}`);
        return migrationFiles;
    }
    
    async getAppliedMigrations() {
        const rows = await this.db.all('SELECT filename FROM migrations');
        return new Set(rows.map(r => r.filename));
    }
    
    async runMigrations() {
        await this.initialize();
        
        const migrationFiles = await this.getMigrationFiles();
        const appliedMigrations = await this.getAppliedMigrations();
        
        let migrationsRun = 0;
        
        for (const filename of migrationFiles) {
            if (appliedMigrations.has(filename)) {
                continue;
            }
            
            console.log(`Running migration: ${filename}`);
            
            try {
                const migrationPath = path.join(__dirname, filename);
                const migration = await import(migrationPath);
                
                if (!migration.up) {
                    console.error(`Migration ${filename} does not export an 'up' function`);
                    continue;
                }
                
                // Run the migration
                await migration.up(this.db);
                
                // Record that it was applied
                await this.db.run(
                    'INSERT INTO migrations (filename) VALUES (?)',
                    [filename]
                );
                
                console.log(`✓ Migration ${filename} completed`);
                migrationsRun++;
                
            } catch (error) {
                console.error(`✗ Migration ${filename} failed:`, error);
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
                throw error; // Stop on first error
            }
        }
        
        if (migrationsRun === 0) {
            console.log('No new migrations to run');
        } else {
            console.log(`Successfully ran ${migrationsRun} migration(s)`);
        }
        
        return migrationsRun;
    }
    
    async rollback(steps = 1) {
        await this.initialize();
        
        // Get applied migrations in reverse order
        const appliedMigrations = await this.db.all(
            'SELECT filename FROM migrations ORDER BY id DESC LIMIT ?',
            [steps]
        );
        
        if (appliedMigrations.length === 0) {
            console.log('No migrations to rollback');
            return 0;
        }
        
        let migrationsRolledBack = 0;
        
        for (const { filename } of appliedMigrations) {
            console.log(`Rolling back migration: ${filename}`);
            
            try {
                const migrationPath = path.join(__dirname, filename);
                const migration = await import(migrationPath);
                
                if (!migration.down) {
                    console.error(`Migration ${filename} does not export a 'down' function`);
                    continue;
                }
                
                // Run the rollback
                await migration.down(this.db);
                
                // Remove from migrations table
                await this.db.run(
                    'DELETE FROM migrations WHERE filename = ?',
                    [filename]
                );
                
                console.log(`✓ Rolled back ${filename}`);
                migrationsRolledBack++;
                
            } catch (error) {
                console.error(`✗ Rollback of ${filename} failed:`, error);
                throw error; // Stop on first error
            }
        }
        
        console.log(`Successfully rolled back ${migrationsRolledBack} migration(s)`);
        return migrationsRolledBack;
    }
    
    async status() {
        await this.initialize();
        
        const migrationFiles = await this.getMigrationFiles();
        const appliedMigrations = await this.getAppliedMigrations();
        
        console.log('Migration Status:');
        console.log('-'.repeat(50));
        
        for (const filename of migrationFiles) {
            const status = appliedMigrations.has(filename) ? '✓ Applied' : '○ Pending';
            console.log(`${status}  ${filename}`);
        }
        
        console.log('-'.repeat(50));
        console.log(`Total: ${migrationFiles.length} migrations`);
        console.log(`Applied: ${appliedMigrations.size}`);
        console.log(`Pending: ${migrationFiles.length - appliedMigrations.size}`);
    }
}

export default MigrationRunner;