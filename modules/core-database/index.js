const BaseModule = require('../../src/core/BaseModule');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

class CoreDatabaseModule extends BaseModule {
    constructor(context) {
        super(context);
        this.db = null;
        this.mediaDb = null;
        this.services = new Map();
    }

    async init() {
        this.logger.info('Initializing core database module');
        
        // Ensure data directory exists
        const dataDir = path.dirname(path.resolve(this.config.path));
        await fs.mkdir(dataDir, { recursive: true });

        // Open main database
        this.db = await this._openDatabase(this.config.path);
        this.logger.info('Main database connected');

        // Open media database
        this.mediaDb = await this._openDatabase(this.config.mediaPath);
        this.logger.info('Media database connected');

        // Initialize services
        await this._initializeServices();

        // Run migrations if enabled
        if (this.config.migrations.autoRun) {
            await this._runMigrations();
        }

        // Set up database as a provided service
        this._provideServices();

        this.emit('database:connected', {
            main: this.config.path,
            media: this.config.mediaPath
        });
    }

    async start() {
        await super.start();
        this.logger.info('Core database module started');
    }

    async stop() {
        this.logger.info('Stopping core database module');

        // Close database connections
        if (this.db) {
            await this.db.close();
            this.db = null;
        }

        if (this.mediaDb) {
            await this.mediaDb.close();
            this.mediaDb = null;
        }

        await super.stop();
    }

    // ===== Database Connection =====

    async _openDatabase(dbPath) {
        const absolutePath = path.resolve(dbPath);
        
        try {
            const db = await open({
                filename: absolutePath,
                driver: sqlite3.Database
            });

            // Configure database
            await db.exec('PRAGMA journal_mode = WAL');
            await db.exec('PRAGMA synchronous = NORMAL');
            await db.exec(`PRAGMA busy_timeout = ${this.config.busyTimeout}`);

            if (this.config.verbose) {
                db.on('trace', (sql) => {
                    this.logger.debug('SQL:', sql);
                });
            }

            return db;
        } catch (error) {
            this.logger.error(`Failed to open database ${dbPath}:`, error);
            throw error;
        }
    }

    // ===== Service Initialization =====

    async _initializeServices() {
        // Load service classes
        const MessageService = require('./services/MessageService');
        const UserService = require('./services/UserService');
        const EconomyService = require('./services/EconomyService');
        const MediaService = require('./services/MediaService');

        // Create service instances
        this.services.set('messages', new MessageService(this.db, this.logger));
        this.services.set('users', new UserService(this.db, this.logger));
        this.services.set('economy', new EconomyService(this.db, this.logger));
        this.services.set('media', new MediaService(this.mediaDb, this.logger));

        // Initialize all services
        for (const [name, service] of this.services) {
            await service.init();
            this.logger.debug(`Initialized service: ${name}`);
        }
    }

    _provideServices() {
        // Provide direct database access
        this.modules.provide('database', {
            main: this.db,
            media: this.mediaDb,
            run: this.run.bind(this),
            get: this.get.bind(this),
            all: this.all.bind(this),
            exec: this.exec.bind(this),
            transaction: this.transaction.bind(this)
        });

        // Provide shorthand
        this.modules.provide('db', this.db);

        // Provide services
        for (const [name, service] of this.services) {
            this.modules.provide(`db:${name}`, service);
        }
    }

    // ===== Database Methods =====

    async run(query, params = [], db = 'main') {
        const database = db === 'media' ? this.mediaDb : this.db;
        
        try {
            const result = await database.run(query, params);
            this.emit('database:query', { 
                type: 'run', 
                query, 
                db,
                changes: result.changes 
            });
            return result;
        } catch (error) {
            this.emit('database:error', { query, params, error: error.message });
            throw error;
        }
    }

    async get(query, params = [], db = 'main') {
        const database = db === 'media' ? this.mediaDb : this.db;
        
        try {
            const result = await database.get(query, params);
            this.emit('database:query', { type: 'get', query, db });
            return result;
        } catch (error) {
            this.emit('database:error', { query, params, error: error.message });
            throw error;
        }
    }

    async all(query, params = [], db = 'main') {
        const database = db === 'media' ? this.mediaDb : this.db;
        
        try {
            const result = await database.all(query, params);
            this.emit('database:query', { 
                type: 'all', 
                query, 
                db,
                rows: result.length 
            });
            return result;
        } catch (error) {
            this.emit('database:error', { query, params, error: error.message });
            throw error;
        }
    }

    async exec(sql, db = 'main') {
        const database = db === 'media' ? this.mediaDb : this.db;
        
        try {
            await database.exec(sql);
            this.emit('database:query', { type: 'exec', db });
        } catch (error) {
            this.emit('database:error', { sql, error: error.message });
            throw error;
        }
    }

    async transaction(callback, db = 'main') {
        const database = db === 'media' ? this.mediaDb : this.db;
        
        try {
            await database.exec('BEGIN TRANSACTION');
            
            try {
                const result = await callback(database);
                await database.exec('COMMIT');
                return result;
            } catch (error) {
                await database.exec('ROLLBACK');
                throw error;
            }
        } catch (error) {
            this.emit('database:error', { 
                context: 'transaction', 
                error: error.message 
            });
            throw error;
        }
    }

    // ===== Migration System =====

    async _runMigrations() {
        const migrationDir = path.join(__dirname, this.config.migrations.directory);
        
        try {
            // Ensure migrations directory exists
            await fs.mkdir(migrationDir, { recursive: true });
            
            // Create migrations table if not exists
            await this._createMigrationsTable();
            
            // Get migration files
            const files = await fs.readdir(migrationDir);
            const migrations = files
                .filter(f => f.endsWith('.sql'))
                .sort();
            
            // Run each migration
            for (const file of migrations) {
                const migrationName = path.basename(file, '.sql');
                
                // Check if already applied
                const applied = await this.db.get(
                    'SELECT * FROM _migrations WHERE name = ?',
                    [migrationName]
                );
                
                if (!applied) {
                    this.logger.info(`Running migration: ${migrationName}`);
                    
                    const sql = await fs.readFile(
                        path.join(migrationDir, file), 
                        'utf8'
                    );
                    
                    await this.transaction(async () => {
                        await this.exec(sql);
                        await this.run(
                            'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
                            [migrationName, Date.now()]
                        );
                    });
                    
                    this.logger.info(`Migration completed: ${migrationName}`);
                }
            }
            
            this.emit('database:migration-complete', { count: migrations.length });
            
        } catch (error) {
            this.logger.error('Migration failed:', error);
            throw error;
        }
    }

    async _createMigrationsTable() {
        await this.exec(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                applied_at INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // ===== Helper Methods =====

    async ensureTable(tableName, schema) {
        const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${schema})`;
        await this.exec(sql);
    }

    async tableExists(tableName, db = 'main') {
        const result = await this.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName],
            db
        );
        return !!result;
    }

    async vacuum(db = 'main') {
        this.logger.info(`Running VACUUM on ${db} database`);
        await this.exec('VACUUM', db);
    }

    async analyze(db = 'main') {
        this.logger.info(`Running ANALYZE on ${db} database`);
        await this.exec('ANALYZE', db);
    }

    async getStats(db = 'main') {
        const database = db === 'media' ? this.mediaDb : this.db;
        
        const stats = {
            tables: {},
            totalSize: 0
        };

        // Get all tables
        const tables = await this.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            [],
            db
        );

        // Get row counts for each table
        for (const table of tables) {
            const result = await this.get(
                `SELECT COUNT(*) as count FROM ${table.name}`,
                [],
                db
            );
            stats.tables[table.name] = result.count;
        }

        // Get database page stats
        const pageStats = await this.get('PRAGMA page_count', [], db);
        const pageSize = await this.get('PRAGMA page_size', [], db);
        
        if (pageStats && pageSize) {
            stats.totalSize = pageStats.page_count * pageSize.page_size;
        }

        return stats;
    }
}

module.exports = CoreDatabaseModule;