# Schema Compatibility Pattern Documentation

## Overview

The codebase implements a dual-schema pattern to handle database schema management for both new installations and existing databases. This pattern separates table creation logic from compatibility updates.

## Current Implementation

### File Structure
Each module that requires database tables has two schema files:
- `schema.js` - Full schema definition with CREATE TABLE statements
- `schema_compat.js` - Compatibility version with only index creation and safe updates

### Examples

1. **Cooldown Module** (`src/utils/`)
   - `cooldownSchema.js` - Creates tables and indexes
   - `cooldownSchema_compat.js` - Only creates indexes

2. **Heist Module** (`src/modules/heist/`)
   - `schema.js` - Creates all tables, inserts default data, creates indexes
   - `schema_compat.js` - Only creates indexes, skips table creation

3. **Video Payout Module** (`src/modules/video_payout/`)
   - `schema.js` - Creates tables and indexes
   - `schema_compat.js` - Only creates indexes

### How It Works

1. **New Installations**: Could use the full `schema.js` files to create all tables from scratch
2. **Existing Databases**: The `database.js` service imports `schema_compat.js` files to avoid table creation errors
3. **Migrations**: Complex schema changes (adding columns, new tables) are handled through the migration system

## Advantages

1. **Safety**: Prevents errors when tables already exist
2. **Separation of Concerns**: Clear distinction between initial setup and updates
3. **Backwards Compatibility**: Existing databases continue to work without modification

## Disadvantages

1. **Code Duplication**: Index creation logic exists in both files
2. **Maintenance Overhead**: Two files to maintain per module
3. **Confusion**: Not immediately clear why two schema files exist
4. **Inconsistent Usage**: The main `database.js` always uses `_compat` versions, making the full schemas unused

## Recommendations

### Option 1: Unified Schema with Mode Parameter (Recommended)

Consolidate into a single schema file that accepts an initialization mode:

```javascript
export const heistSchema = {
    async initialize(database, mode = 'compat') {
        if (mode === 'full') {
            // Create tables
            await database.run(this.createUserEconomyTable);
            await database.run(this.createHeistEventsTable);
            // ... other tables
        }
        
        // Always create indexes (safe with IF NOT EXISTS)
        await database.run(this.createUserEconomyBalanceIndex);
        await database.run(this.createHeistEventsUsernameIndex);
        // ... other indexes
        
        if (mode === 'full') {
            // Insert default data
            await database.run(this.insertDefaultCrimeTypes);
        }
    }
}
```

### Option 2: Migrate Everything to Migration System

Since the codebase already has a robust migration system:
1. Move all table creation to timestamped migration files
2. Remove schema files entirely
3. Let the migration runner handle all schema management

This would provide:
- Version control for schema changes
- Rollback capability
- Clear history of schema evolution
- Single source of truth

### Option 3: Keep Current Pattern but Document Better

If the current pattern works well:
1. Add clear comments in each schema file explaining the pattern
2. Create a naming convention guide
3. Ensure all new modules follow the pattern consistently

## Conclusion

The current dual-schema pattern appears to be a transitional solution. The codebase has evolved to use a migration system for schema changes, making the dual-schema pattern somewhat redundant. 

**Recommendation**: Adopt Option 2 - fully embrace the migration system for all schema management. This would:
- Eliminate the confusion of having two schema files
- Provide better tracking of schema changes
- Reduce maintenance overhead
- Align with modern database management practices

The migration system is already handling complex schema updates well (as seen in the heist multiroom migration), making it the natural choice for all schema management.