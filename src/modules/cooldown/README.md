# Cooldown Module

The cooldown module provides a unified cooldown management system for the Dazza bot. It abstracts between memory-based and persistent database storage, automatically selecting the appropriate storage type based on cooldown duration.

## Features

- **Dual Storage**: Automatic selection between memory and persistent storage
- **Smart Thresholds**: Auto-selects storage type based on cooldown duration
- **Room Support**: Multi-room cooldown management with room isolation
- **Cleanup Management**: Automatic cleanup of expired cooldowns
- **Legacy Compatibility**: Maintains compatibility with existing cooldown interfaces
- **Australian Messages**: Creative cooldown messages with Australian flavor
- **Performance Optimized**: Caching and batch operations for optimal performance
- **Event Integration**: Emits events for cooldown lifecycle

## Architecture

### Storage Types

#### Memory Store
- **Use Case**: Short-term cooldowns (< 10 minutes by default)
- **Storage**: In-memory Map structure
- **Performance**: Ultra-fast access, automatic cleanup
- **Persistence**: Lost on restart (appropriate for short cooldowns)

#### Persistent Store  
- **Use Case**: Long-term cooldowns (>= 10 minutes by default)
- **Storage**: SQLite database with optimized indexing
- **Performance**: Database-backed with caching
- **Persistence**: Survives bot restarts

### Services

- **CooldownManager**: Unified interface managing both storage types
- **MemoryStore**: In-memory cooldown storage with LRU eviction
- **PersistentStore**: Database-backed storage with batch operations
- **KeyGenerator**: Standardized key generation and parsing

## Configuration

```json
{
  "thresholds": {
    "memory": 600000,
    "persistent": 600000
  },
  "cleanup": {
    "memoryInterval": 300000,
    "persistentInterval": 86400000,
    "maxAge": 604800000
  },
  "storage": {
    "memoryLimit": 10000,
    "persistentBatchSize": 100
  },
  "messages": {
    "useCustomMessages": true,
    "placeholder": "{time}",
    "defaultTemplate": "hold ya horses champion, {time} more seconds"
  }
}
```

## Database Schema

### cooldowns Table
- `command_name` (TEXT) - Command name
- `username` (TEXT) - Username (lowercase)
- `room_id` (TEXT) - Room identifier
- `last_used` (INTEGER) - Timestamp when cooldown started
- `created_at` (DATETIME) - Creation timestamp
- **Primary Key**: (command_name, username, room_id)

### Indexes
- `idx_cooldowns_last_used` - For cleanup operations
- `idx_cooldowns_username` - For user-specific queries
- `idx_cooldowns_room_id` - For room-specific operations

## Usage

### Basic Cooldown Checking

```javascript
// Check if cooldown is active
const result = await cooldown.checkCooldown('ping', 'username', 5000);

if (result.allowed) {
    // Execute command
    await cooldown.setCooldown('ping', 'username', 5000);
} else {
    // Send cooldown message
    console.log(result.message); // "hold ya horses champion, 3 more seconds"
}
```

### Advanced Options

```javascript
// Multi-room support
const result = await cooldown.checkCooldown('help', 'user', 5000, {
    roomId: 'my_room',
    customMessage: 'wait {time} seconds mate',
    usePersistent: false  // Force memory storage
});

// Get remaining time
const remaining = await cooldown.getRemaining('mug', 'user', 7200000);
if (remaining) {
    console.log(`${remaining} seconds left`);
}
```

### User Management

```javascript
// Get all user cooldowns
const userCooldowns = await cooldown.getUserCooldowns('username');

// Get cooldowns for specific room
const roomCooldowns = await cooldown.getUserCooldowns('username', {
    roomId: 'specific_room'
});

// Reset specific cooldown
await cooldown.resetCooldown('beg', 'username');
```

### Command Management

```javascript
// Get all cooldowns for a command
const commandCooldowns = await cooldown.getCommandCooldowns('mug');

// Clean up old cooldowns
const cleaned = await cooldown.cleanupCooldowns();
console.log(`Cleaned ${cleaned.total} expired cooldowns`);
```

## Key Generation

### Standardized Format
- **Pattern**: `command:username:room_id`
- **Example**: `ping:johndoe:fatpizza`
- **Legacy**: `ping:johndoe` (auto-migrated)

### Pattern Matching
```javascript
// User pattern: get all cooldowns for user
const pattern = "*:username:*";

// Command pattern: get all cooldowns for command
const pattern = "ping:*:*";

// Room pattern: get all cooldowns in room
const pattern = "*:*:room_id";
```

## Automatic Storage Selection

### Memory Storage (< 10 minutes)
- Basic commands: ping, help, stats
- Fast response time required
- Temporary nature acceptable

### Persistent Storage (>= 10 minutes)
- Economy commands: mug, beg, bottles
- Long cooldowns that must survive restarts
- Critical for game balance

### Manual Override
```javascript
// Force persistent storage for short cooldown
await cooldown.setCooldown('special', 'user', 30000, {
    usePersistent: true
});

// Force memory storage for long cooldown
await cooldown.setCooldown('test', 'user', 3600000, {
    usePersistent: false
});
```

## Cooldown Messages

### Default Messages (25+ variations)
- Australian-themed humor and slang
- Dynamic time replacement with `{time}` placeholder
- Random selection for variety

### Custom Messages
```javascript
// Command-specific custom message
const result = await cooldown.checkCooldown('bong', 'user', 300000, {
    customMessage: 'easy on the cones mate, ya lungs need {time}s to recover'
});
```

## Events

### Emitted Events
- `cooldown.started` - When cooldown is set
- `cooldown.checked` - When cooldown is checked
- `cooldown.reset` - When cooldown is manually reset
- `cooldown.expired` - When cooldowns are cleaned up

### Event Data
```javascript
// cooldown.started event
{
    commandName: 'ping',
    username: 'user',
    duration: 5000,
    options: { roomId: 'fatpizza' }
}
```

## Performance

### Memory Store
- **Capacity**: 10,000 entries with LRU eviction
- **Access Time**: O(1) for all operations
- **Cleanup**: Automatic every 5 minutes

### Persistent Store
- **Indexing**: Optimized database indexes for fast queries
- **Batch Operations**: Bulk cleanup operations
- **Connection Pooling**: Efficient database connection management

### Caching Strategy
- Memory store acts as L1 cache for short cooldowns
- Persistent store for long-term storage
- Automatic cache invalidation on cooldown reset

## Migration

### From Legacy System
```javascript
// Migrate existing cooldowns
const oldCooldowns = {
    'ping:user': timestamp,
    'help:user': timestamp
};

await cooldown.migrateFromLegacy(oldCooldowns);
```

### Legacy Compatibility
```javascript
// Old interface still supported
const legacyInterface = cooldown.getLegacyInterface();
const result = await legacyInterface.check('ping:user', 5000);
```

## Monitoring

### Statistics
```javascript
const stats = await cooldown.getStats();
console.log(stats);
// {
//   memory: { hits: 150, misses: 20, size: 45 },
//   persistent: { hits: 30, misses: 5, totalEntries: 120 },
//   config: { thresholds: {...} }
// }
```

### Health Checks
- Memory usage monitoring
- Database connection health
- Cleanup operation success rates
- Performance metrics tracking

## Integration

### Command System
The cooldown module integrates seamlessly with the command system:

```javascript
// In command handler
const cooldownResult = await bot.cooldown.checkCooldown(
    command.name, 
    message.username, 
    command.cooldown
);

if (!cooldownResult.allowed) {
    return { success: false, error: cooldownResult.message };
}

// Execute command...
await bot.cooldown.setCooldown(command.name, message.username, command.cooldown);
```

### Bot Context
The module provides a simplified interface for bot integration while maintaining the full API for advanced usage.

This unified cooldown system eliminates the complexity of managing dual storage types while providing optimal performance and reliability for both short-term and long-term cooldowns.