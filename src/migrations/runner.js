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
        this.logger = db.logger || console;
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
        this.logger.info(`Looking for migrations in: ${__dirname}`);
        const files = await fs.readdir(__dirname);
        const migrationFiles = files
            .filter(f => f.endsWith('.js') && f !== 'runner.js')
            .sort(); // Sort by filename (which includes date)
        this.logger.info(`Found migration files: ${migrationFiles.join(', ')}`);
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
            
            this.logger.info(`Running migration: ${filename}`);
            
            try {
                const migrationPath = path.join(__dirname, filename);
                const migration = await import(migrationPath);
                
                if (!migration.up) {
                    this.logger.error(`Migration ${filename} does not export an 'up' function`);
                    continue;
                }
                
                // Run the migration
                await migration.up(this.db, this.logger);
                
                // Record that it was applied
                await this.db.run(
                    'INSERT INTO migrations (filename) VALUES (?)',
                    [filename]
                );
                
                this.logger.info(`✓ Migration ${filename} completed`);
                migrationsRun++;
                
            } catch (error) {
                this.logger.error(`✗ Migration ${filename} failed:`, error);
                this.logger.error('Error details:', error.message);
                this.logger.error('Error stack:', error.stack);
                throw error; // Stop on first error
            }
        }
        
        if (migrationsRun === 0) {
            this.logger.info('No new migrations to run');
        } else {
            this.logger.info(`Successfully ran ${migrationsRun} migration(s)`);
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
            this.logger.info('No migrations to rollback');
            return 0;
        }
        
        let migrationsRolledBack = 0;
        
        for (const { filename } of appliedMigrations) {
            this.logger.info(`Rolling back migration: ${filename}`);
            
            try {
                const migrationPath = path.join(__dirname, filename);
                const migration = await import(migrationPath);
                
                if (!migration.down) {
                    this.logger.error(`Migration ${filename} does not export a 'down' function`);
                    continue;
                }
                
                // Run the rollback
                await migration.down(this.db, this.logger);
                
                // Remove from migrations table
                await this.db.run(
                    'DELETE FROM migrations WHERE filename = ?',
                    [filename]
                );
                
                this.logger.info(`✓ Rolled back ${filename}`);
                migrationsRolledBack++;
                
            } catch (error) {
                this.logger.error(`✗ Rollback of ${filename} failed:`, error);
                throw error; // Stop on first error
            }
        }
        
        this.logger.info(`Successfully rolled back ${migrationsRolledBack} migration(s)`);
        return migrationsRolledBack;
    }
    
    async status() {
        await this.initialize();
        
        const migrationFiles = await this.getMigrationFiles();
        const appliedMigrations = await this.getAppliedMigrations();
        
        this.logger.info('Migration Status:');
        this.logger.info('-'.repeat(50));
        
        for (const filename of migrationFiles) {
            const status = appliedMigrations.has(filename) ? '✓ Applied' : '○ Pending';
            this.logger.info(`${status}  ${filename}`);
        }
        
        this.logger.info('-'.repeat(50));
        this.logger.info(`Total: ${migrationFiles.length} migrations`);
        this.logger.info(`Applied: ${appliedMigrations.size}`);
        this.logger.info(`Pending: ${migrationFiles.length - appliedMigrations.size}`);
    }
}

export default MigrationRunner;