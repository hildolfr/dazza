const BaseModule = require('../../core/BaseModule');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

// Import services
const MessageService = require('./services/MessageService');
const UserService = require('./services/UserService');
const EconomyService = require('./services/EconomyService');
const MediaService = require('./services/MediaService');

class CoreDatabaseModule extends BaseModule {
    constructor(context) {
        super(context);
        this.mainDb = null;
        this.mediaDb = null;
        this.services = {};
        this.transactionDepth = 0;
    }
    
    async init() {
        await super.init();
        
        // Open main database
        this.mainDb = await this.openDatabase(this.config.mainDatabase.path, 'main');
        
        // Open media database
        this.mediaDb = await this.openDatabase(this.config.mediaDatabase.path, 'media');
        
        // Run migrations
        if (this.config.migrations.autoRun) {
            await this.runMigrations();
        }
        
        // Initialize services
        await this.initializeServices();
        
        // Register as global service
        this.eventBus.emit('service:register', {
            name: 'database',
            service: this
        });
        
        this.logger.info('Database module initialized');
    }
    
    async start() {
        await super.start();
        
        // Schedule maintenance tasks
        this.scheduleTask('vacuum', '0 3 * * *', async () => {
            await this.performMaintenance();
        });
        
        this.logger.info('Database module started');
    }
    
    async stop() {
        await super.stop();
        
        // Close databases
        if (this.mainDb) {
            await this.mainDb.close();
        }
        if (this.mediaDb) {
            await this.mediaDb.close();
        }
        
        this.logger.info('Database module stopped');
    }
    
    // ===== Database Connection Management =====
    
    async openDatabase(dbPath, name) {
        try {
            const absolutePath = path.resolve(dbPath);
            const dir = path.dirname(absolutePath);
            
            // Ensure directory exists
            await fs.mkdir(dir, { recursive: true });
            
            const db = await open({
                filename: absolutePath,
                driver: sqlite3.Database,
                mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
            });
            
            // Configure database
            await db.exec('PRAGMA journal_mode = WAL');
            await db.exec('PRAGMA synchronous = NORMAL');
            await db.exec('PRAGMA cache_size = 10000');
            await db.exec('PRAGMA temp_store = MEMORY');
            
            if (this.config[name + 'Database']?.options?.verbose) {
                db.on('trace', (sql) => {
                    this.logger.debug(`SQL [${name}]:`, sql);
                });
            }
            
            this.logger.info(`Opened ${name} database: ${absolutePath}`);
            return db;
            
        } catch (error) {
            this.logger.error(`Failed to open ${name} database:`, error);
            throw error;
        }
    }
    
    // ===== Migration System =====
    
    async runMigrations() {
        const migrationsDir = path.join(__dirname, 'migrations');
        
        try {
            // Create migrations table if not exists
            await this.mainDb.exec(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY,
                    filename TEXT NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Get applied migrations
            const appliedMigrations = await this.mainDb.all(
                'SELECT filename FROM migrations'
            );
            const appliedSet = new Set(appliedMigrations.map(m => m.filename));
            
            // Read migration files
            const files = await fs.readdir(migrationsDir);
            const migrationFiles = files
                .filter(f => f.endsWith('.sql'))
                .sort();
            
            // Apply new migrations
            for (const file of migrationFiles) {
                if (!appliedSet.has(file)) {
                    await this.applyMigration(file);
                }
            }
            
            this.logger.info('Database migrations completed');
            
        } catch (error) {
            this.logger.error('Migration failed:', error);
            throw error;
        }
    }
    
    async applyMigration(filename) {
        const migrationPath = path.join(__dirname, 'migrations', filename);
        
        try {
            const sql = await fs.readFile(migrationPath, 'utf8');
            
            await this.mainDb.exec('BEGIN TRANSACTION');
            
            try {
                await this.mainDb.exec(sql);
                
                await this.mainDb.run(
                    'INSERT INTO migrations (filename) VALUES (?)',
                    filename
                );
                
                await this.mainDb.exec('COMMIT');
                
                this.logger.info(`Applied migration: ${filename}`);
                
            } catch (error) {
                await this.mainDb.exec('ROLLBACK');
                throw error;
            }
            
        } catch (error) {
            this.logger.error(`Failed to apply migration ${filename}:`, error);
            throw error;
        }
    }
    
    // ===== Service Initialization =====
    
    async initializeServices() {
        this.services.messages = new MessageService(this.mainDb, this);
        this.services.users = new UserService(this.mainDb, this);
        this.services.economy = new EconomyService(this.mainDb, this);
        this.services.media = new MediaService(this.mediaDb, this);
        
        // Initialize each service
        for (const service of Object.values(this.services)) {
            if (service.init) {
                await service.init();
            }
        }
    }
    
    // ===== Query Methods =====
    
    async run(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mainDb.run(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'run', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async get(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mainDb.get(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'get', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async all(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mainDb.all(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'all', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async exec(sql) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mainDb.exec(sql);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'exec', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { sql });
            throw error;
        }
    }
    
    // ===== Transaction Support =====
    
    async transaction(callback) {
        this.transactionDepth++;
        
        if (this.transactionDepth === 1) {
            await this.mainDb.exec('BEGIN TRANSACTION');
        }
        
        try {
            const result = await callback();
            
            this.transactionDepth--;
            if (this.transactionDepth === 0) {
                await this.mainDb.exec('COMMIT');
            }
            
            return result;
        } catch (error) {
            this.transactionDepth--;
            if (this.transactionDepth === 0) {
                await this.mainDb.exec('ROLLBACK');
            }
            throw error;
        }
    }
    
    // ===== Media Database Methods =====
    
    async runMedia(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mediaDb.run(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'run-media', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async getMedia(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mediaDb.get(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'get-media', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async allMedia(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.mediaDb.all(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'all-media', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    // ===== Maintenance =====
    
    async performMaintenance() {
        this.logger.info('Starting database maintenance');
        
        try {
            // Vacuum main database
            await this.mainDb.exec('VACUUM');
            await this.mainDb.exec('ANALYZE');
            
            // Vacuum media database
            await this.mediaDb.exec('VACUUM');
            await this.mediaDb.exec('ANALYZE');
            
            // Clean old data
            await this.cleanOldData();
            
            this.logger.info('Database maintenance completed');
            
        } catch (error) {
            this.logger.error('Database maintenance failed:', error);
        }
    }
    
    async cleanOldData() {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        // Clean old messages (keep last 30 days)
        await this.mainDb.run(
            'DELETE FROM messages WHERE timestamp < ?',
            thirtyDaysAgo
        );
        
        // Clean old user events (keep last 30 days)
        await this.mainDb.run(
            'DELETE FROM user_events WHERE timestamp < ?',
            thirtyDaysAgo
        );
    }
    
    // ===== Statistics =====
    
    async getDatabaseStats() {
        const stats = {};
        
        // Main database stats
        const tables = await this.mainDb.all(`
            SELECT name, sql FROM sqlite_master 
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        `);
        
        for (const table of tables) {
            const count = await this.mainDb.get(
                `SELECT COUNT(*) as count FROM ${table.name}`
            );
            stats[table.name] = count.count;
        }
        
        // Database file sizes
        try {
            const mainStats = await fs.stat(path.resolve(this.config.mainDatabase.path));
            const mediaStats = await fs.stat(path.resolve(this.config.mediaDatabase.path));
            
            stats.fileSizes = {
                main: mainStats.size,
                media: mediaStats.size
            };
        } catch (error) {
            // Ignore file stat errors
        }
        
        return stats;
    }
    
    // ===== Service Getters =====
    
    getMessageService() {
        return this.services.messages;
    }
    
    getUserService() {
        return this.services.users;
    }
    
    getEconomyService() {
        return this.services.economy;
    }
    
    getMediaService() {
        return this.services.media;
    }
}

module.exports = CoreDatabaseModule;