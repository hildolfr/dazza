# Guide: Transitioning from Dual-Schema Pattern to Migration-Only Pattern

## Overview

This guide outlines how to transition from the current dual-schema pattern (schema.js + schema_compat.js) to a migration-only pattern where all schema management is handled through the migration system.

## Current State Analysis

### What We Have
1. **Dual Schema Files**: Each module has both `schema.js` and `schema_compat.js`
2. **Migration System**: Already handles complex schema changes
3. **Mixed Approach**: Initial tables created via schema files, updates via migrations

### Issues with Current Approach
- Redundancy between schema files and migrations
- Unclear when to use which approach
- Maintenance overhead of keeping two patterns in sync

## Transition Plan

### Step 1: Create Initial Schema Migration

For each module, create a migration that contains the full schema:

```javascript
// src/migrations/2025-07-04-initial-schema-consolidation.js
export const up = async (db, logger) => {
    // Check if this is a fresh install
    const tables = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT IN ('migrations', 'sqlite_sequence')
    `);
    
    if (tables.length > 0) {
        logger.info('Database already initialized, skipping initial schema');
        return;
    }
    
    // Create all base tables
    await createCoreTables(db);
    await createHeistTables(db);
    await createVideoPayoutTables(db);
    await createCooldownTables(db);
    
    // Create all indexes
    await createAllIndexes(db);
    
    // Insert default data
    await insertDefaultData(db);
};
```

### Step 2: Update Database Service

Modify `database.js` to rely solely on migrations:

```javascript
// src/services/database.js
class Database {
    async init() {
        // ... existing connection code ...
        
        // Only run migrations, no schema initialization
        await this.runMigrations();
    }
    
    async runMigrations() {
        const runner = new MigrationRunner(this);
        await runner.runMigrations();
    }
}
```

### Step 3: Remove Schema Imports

Remove all schema imports from `database.js`:
```javascript
// Remove these lines:
// import { heistSchema } from '../modules/heist/schema_compat.js';
// import { videoPayoutSchema } from '../modules/video_payout/schema_compat.js';
// import { cooldownSchema } from '../utils/cooldownSchema_compat.js';
```

### Step 4: Archive Schema Files

Move existing schema files to an archive directory for reference:
```bash
mkdir src/archived_schemas
mv src/modules/*/schema*.js src/archived_schemas/
mv src/utils/*Schema*.js src/archived_schemas/
```

## Benefits of Migration-Only Approach

1. **Single Source of Truth**: All schema changes in one place
2. **Version Control**: Clear history of when each change was made
3. **Rollback Support**: Can undo changes if needed
4. **Consistency**: One pattern for all schema management
5. **Easier Onboarding**: New developers only need to understand one system

## Migration Best Practices

### 1. Idempotent Migrations
Always use `IF NOT EXISTS` and check before making changes:

```javascript
// Good
await db.run('CREATE TABLE IF NOT EXISTS users (...)');
await db.run('CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)');

// Check before adding columns
const columns = await db.all('PRAGMA table_info(users)');
if (!columns.some(col => col.name === 'email')) {
    await db.run('ALTER TABLE users ADD COLUMN email TEXT');
}
```

### 2. Transactional Migrations
Wrap migrations in transactions:

```javascript
export const up = async (db, logger) => {
    await db.run('BEGIN TRANSACTION');
    try {
        // All migration steps
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
};
```

### 3. Meaningful Names
Use descriptive migration names:
- `2025-07-04-add-user-authentication.js` ✓
- `2025-07-04-update.js` ✗

### 4. Small, Focused Migrations
Each migration should do one thing:
- Add a single feature's tables
- Update a specific table structure
- Add indexes for performance

## Implementation Timeline

1. **Week 1**: Create comprehensive initial schema migration
2. **Week 2**: Test migration on fresh database and existing database
3. **Week 3**: Update database service, remove schema imports
4. **Week 4**: Archive old schema files, update documentation

## Rollback Plan

If issues arise:
1. Keep schema files in archive (don't delete)
2. Can revert database.js to use schema files
3. Migration system remains compatible

## Conclusion

Transitioning to a migration-only pattern will simplify schema management and align with modern database practices. The migration system is already proven in the codebase, making this a natural evolution.