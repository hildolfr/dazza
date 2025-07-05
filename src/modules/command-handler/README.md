# Command Handler Module

The command-handler module provides centralized command processing and routing for the Dazza bot. It handles command discovery, registration, execution, and management.

## Features

- **Command Discovery**: Automatically discovers and loads commands from the filesystem
- **Command Registration**: Provides a registry system for managing commands
- **Command Execution**: Handles command parsing, validation, and execution
- **Rate Limiting**: Built-in rate limiting to prevent spam
- **Permission System**: Integrates with bot permission system
- **Cooldown Management**: Supports both memory-based and persistent cooldowns
- **Hot Reloading**: Supports dynamic command reloading
- **Event System**: Emits events for command lifecycle
- **PM Support**: Handles both chat and private message commands

## Architecture

### Services

- **Command**: Base class for all commands
- **CommandRegistry**: Manages command storage and retrieval
- **CommandLoader**: Handles command discovery and loading

### Events

#### Subscribed Events
- `chat.message` - Processes chat messages for commands
- `chat.pm` - Processes private messages for commands

#### Emitted Events
- `command.executed` - When a command is successfully executed
- `command.failed` - When a command fails to execute
- `command.ratelimited` - When a user hits rate limits
- `command.cooldown` - When a user is on cooldown
- `command.permission_denied` - When a user lacks permissions

### Provided Capabilities
- `command.register` - Register new commands
- `command.unregister` - Unregister commands
- `command.execute` - Execute commands
- `command.get` - Get specific commands
- `command.getAll` - Get all commands
- `command.getByCategory` - Get commands by category

## Configuration

```json
{
  "commandPrefix": "!",
  "rateLimitWindow": 2000,
  "rateLimitMax": 3,
  "defaultCooldown": 5000,
  "maxArguments": 50,
  "maxCommandLength": 100,
  "categories": ["basic", "fun", "utility", "stats", "communication", "economy", "admin"]
}
```

## Usage

### Creating a Command

```javascript
const Command = require('./services/Command');

const myCommand = new Command({
    name: 'example',
    aliases: ['ex', 'test'],
    description: 'An example command',
    usage: '!example [arg]',
    category: 'utility',
    cooldown: 5000,
    adminOnly: false,
    pmAccepted: true,
    pmResponses: false,
    handler: async (bot, message, args) => {
        // Command logic here
        return { success: true, response: 'Command executed!' };
    }
});
```

### Registering Commands

Commands are automatically loaded from the filesystem, but can also be registered programmatically:

```javascript
// Via event system
eventBus.emit('command.register', myCommand);

// Via module API
commandHandler.registerCommand(myCommand);
```

### Command Execution Flow

1. **Message Processing**: Chat messages are filtered for command prefix
2. **Command Parsing**: Command name and arguments are extracted
3. **Rate Limiting**: User rate limits are checked
4. **Command Lookup**: Command is retrieved from registry
5. **Permission Check**: User permissions are validated
6. **Cooldown Check**: Command cooldowns are enforced
7. **Execution**: Command handler is invoked
8. **Response**: Result is processed and response sent

### Permission System

Commands support multiple permission levels:

- **adminOnly**: Only admins can execute
- **users**: Array of specific usernames allowed
- **Special values**: 'all' (everyone), 'admin' (admins only)

### Cooldown System

Commands support cooldowns to prevent spam:

- **Memory-based**: Fast, temporary cooldowns
- **Persistent**: Database-backed cooldowns that survive restarts
- **Custom messages**: Commands can provide custom cooldown messages

### Rate Limiting

Built-in rate limiting prevents users from spamming commands:

- **Window**: Time window for rate limiting (default: 2000ms)
- **Max**: Maximum commands per window (default: 3)
- **Per-user**: Rate limits are applied per user

## Integration

The command-handler module integrates with:

- **Bot Core**: Provides bot context for command execution
- **Permission System**: Checks user permissions
- **Cooldown System**: Manages command cooldowns
- **Database**: Stores persistent cooldowns and stats
- **Event System**: Communicates via events

## Migration

This module replaces the existing command system in `src/commands/` by:

1. Converting ES6 modules to CommonJS
2. Providing a centralized command handler
3. Adding rate limiting and improved error handling
4. Supporting hot reloading and dynamic management
5. Integrating with the modular architecture

Existing commands will continue to work with minimal changes.