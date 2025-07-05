# Message Processing Module

Core message processing functionality extracted from bot.js to handle message validation, filtering, routing, and processing in a modular way.

## Overview

This module handles the critical message flow pipeline:
1. Message deduplication and staleness filtering
2. Bot message detection and echo prevention
3. Message history maintenance
4. URL detection and commenting
5. Event emission for API/WebSocket
6. Database logging
7. Game response handling (coin flip, pissing contest)
8. Mention detection and routing
9. Command routing

## Services

### MessageProcessor

The main service that handles all message processing logic.

**Key Methods:**
- `processMessage(messageData, botContext)` - Main message processing entry point
- `trackBotMessage(message)` - Track bot's own messages for echo detection
- `getMessageHistory()` - Get message history for context
- `hasMention(message)` - Check if message mentions Dazza

## Dependencies

**Required:**
- `core-database` - For message logging and game state

**Optional:**
- `permissions` - For permission checking
- `cooldown` - For rate limiting

## Configuration

The module uses configuration from `config.bot.username` to identify bot messages.

## Message Flow

```
Raw Message → Duplicate Check → Staleness Check → Bot Filter → Echo Detection
     ↓
Message History → Database Logging → Event Emission → URL Processing
     ↓
Tell Delivery → Heist Notification → Mention Detection → Game Responses → Commands
```

## Integration

### From Bot Context

```javascript
// In bot.js or main application
const messageProcessor = services.get('messageProcessor');

// Process incoming message
const result = await messageProcessor.processMessage(messageData, {
    username: this.username,
    connection: this.connection,
    heistManager: this.heistManager,
    pissingContestManager: this.pissingContestManager,
    commands: this.commands,
    sendMessage: (msg) => this.sendMessage(msg),
    handleCommand: (data) => this.handleCommand(data),
    handleMention: (data, roomId) => this.handleMention(data, roomId),
    checkAndDeliverTells: (username) => this.checkAndDeliverTells(username)
});

// Track bot's own messages
messageProcessor.trackBotMessage(sentMessage);
```

### Message Processing Result

```javascript
{
    processed: true,  // Whether message was processed
    result: {
        messageId: 123,
        canonicalUsername: "user"
    },
    reason: "duplicate" | "stale" | "bot_message" | "bot_echo" | "not_ready"
}
```

## Features

### Deduplication
- Tracks processed messages using unique message IDs
- Prevents duplicate processing of the same message
- Automatic memory management to prevent memory leaks

### Staleness Filtering
- Filters messages older than 30 seconds
- Prevents processing of delayed or buffered messages

### Bot Message Detection
- Identifies bot's own messages using username comparison
- Detects recent bot message echoes using message hashing
- Logs HTML tag warnings in bot messages

### URL Processing
- Detects URLs in messages and logs to database
- Random URL commenting with cooldowns (50% chance)
- Drunk typing delays for authentic behavior
- Domain extraction and categorization

### Game Integration
- Handles pissing contest accept/decline responses
- Processes coin flip challenge responses
- Routes to appropriate game managers

### Mention Detection
- Advanced pattern matching for Dazza mentions
- Distinguishes between mentions TO vs ABOUT Dazza
- Filters out bot/server mentions

### Event System
- Emits chat:message events for WebSocket clients
- Emits stats:user:update events for analytics
- Emits gallery:image:added events for image processing

## Message History

The module maintains a rolling buffer of recent messages for:
- AI context generation
- Conversation flow analysis
- Debugging and monitoring

## Performance

- Memory-efficient message tracking with automatic cleanup
- Fast duplicate detection using Set lookups
- Configurable history and cache sizes
- Minimal database queries through service injection

## Migration Notes

This module extracts ~200 lines of critical functionality from bot.js:
- Message deduplication (lines 466-511)
- Bot message filtering (lines 513-545)
- URL detection and commenting (lines 631-678)
- Game response handling (lines 714-817)
- Mention detection (lines 688-711)

The module maintains all existing functionality while providing a clean, testable, and modular interface.