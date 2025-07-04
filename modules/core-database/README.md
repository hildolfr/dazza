# Core Database Module

The core database module provides centralized database access for all other modules in the Dazza bot system.

## Features

- SQLite database management with connection pooling
- Automatic schema migrations
- Service-based access to different data domains
- Transaction support
- Performance monitoring
- Separate databases for main data and media tracking

## Services Provided

### Direct Database Access
- `database` - Object containing database connections and query methods
- `db` - Direct access to main database connection

### Data Services
- `db:messages` - Message storage and retrieval
- `db:users` - User statistics and event tracking
- `db:economy` - Economy system, transactions, and counters
- `db:media` - Media history tracking

## Configuration

```json
{
  "path": "./data/cytube_stats.db",
  "mediaPath": "./data/media_encountered.db",
  "busyTimeout": 5000,
  "verbose": false,
  "migrations": {
    "autoRun": true,
    "directory": "./migrations"
  }
}
```

## Usage Example

```javascript
// In another module
class MyModule extends BaseModule {
    async init() {
        // Get services
        this.messageService = this.requireModule('core-database').services.get('messages');
        this.db = this.modules.get('db');
        
        // Save a message
        await this.messageService.saveMessage('user123', 'Hello world');
        
        // Direct database query
        const users = await this.db.all('SELECT * FROM user_stats LIMIT 10');
    }
}
```

## Database Schema

See the migration files in the `migrations/` directory for the complete schema definition.

## Events Emitted

- `database:connected` - When databases are successfully opened
- `database:error` - When a database error occurs
- `database:query` - When a query is executed (if verbose mode enabled)
- `database:migration-complete` - When migrations finish running