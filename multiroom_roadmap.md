# Multi-Room Support Roadmap for Dazza Bot

## Executive Summary

This document outlines the comprehensive roadmap for implementing multi-room support in the Dazza bot. The current architecture is deeply integrated with single-room assumptions, making this a significant architectural change rather than a simple feature addition. This roadmap assumes we will proceed with modifying the monolithic singular instance to support multiple rooms simultaneously.

## 1. Connection Architecture Challenges

### Current State
- Single `CyTubeConnection` instance managing one WebSocket connection
- Single channel authentication and join flow
- Global connection state (`connected`, `authenticated` booleans)
- No room context in socket events

### Required Changes
- **Connection Multiplexing**: Implement connection pool for multiple WebSocket connections
- **Room Context**: Add room identification to all socket events
- **State Isolation**: Per-room connection state tracking
- **Authentication**: Support multiple room credentials

### Specific Concerns
- Socket.IO connection limits and memory overhead (~30-50KB per connection)
- Rate limiting needs to be per-room, not global
- Reconnection logic must handle individual room failures
- Event listener accumulation risk with multiple rooms

## 2. State Management Challenges

### Current State
- Global state variables in `CyTubeBot` class:
  - `this.userlist` - Single Map for all users
  - `this.currentMedia` - Single media object
  - `this.playlist` - Single playlist array
  - `this.messageHistory` - Single message buffer
  - `this.lastGreetings` - Global greeting cooldowns

### Required Changes
- **Room Context Objects**: Create per-room state containers
- **State Isolation**: Prevent cross-room state pollution
- **Memory Management**: Implement per-room cleanup strategies
- **Cooldown Scoping**: Per-room cooldown tracking

### Specific Concerns
- Memory usage will multiply (150-300KB base per room)
- Risk of memory leaks from uncleaned room state
- Potential race conditions when accessing shared resources
- Complex debugging with multiple state contexts

## 3. Database Schema Modifications

### Tables Requiring room_id Column
```sql
-- Chat and messaging
ALTER TABLE messages ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE user_events ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE posted_urls ADD COLUMN room_id TEXT NOT NULL;

-- Game/economy tables
ALTER TABLE heist_events ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE coin_flip_challenges ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE pissing_contest_challenges ADD COLUMN room_id TEXT NOT NULL;

-- Counter tables
ALTER TABLE bong_counter ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE drink_counter ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE user_bongs ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE user_drinks ADD COLUMN room_id TEXT NOT NULL;

-- Communication
ALTER TABLE reminders ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE tells ADD COLUMN room_id TEXT NOT NULL;
ALTER TABLE cooldowns ADD COLUMN room_id TEXT NOT NULL;
```

### Tables Remaining Global (Shared Across Rooms)
- `user_stats` - Global user statistics
- `user_economy` - Global wallet/balance
- `user_images` - Global gallery (per requirements)
- `user_gallery_locks` - Gallery permissions
- `crime_types` - Global definitions
- `migrations` - System table

### New Tables Required
```sql
CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    first_joined INTEGER NOT NULL,
    last_active INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    config TEXT -- JSON room-specific configuration
);

CREATE TABLE room_user_presence (
    room_id TEXT NOT NULL,
    username TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    PRIMARY KEY (room_id, username)
);
```

### Database Performance Concerns
- SQLite single-writer limitation will serialize all room updates
- Need indexes on all room_id columns for query performance
- Potential migration to PostgreSQL for connection pooling
- Query complexity increases with room filtering

## 4. Command System Modifications

### Current Issues
- Commands have no room context
- Cooldowns are global, not per-room
- Permission checking doesn't consider room context
- Command routing assumes single room

### Required Changes
```javascript
// Add room context to command execution
const result = await this.commands.execute(commandName, this, {
    username: data.username,
    msg: data.msg,
    time: data.time || Date.now(),
    roomId: this.currentRoomId  // NEW
}, args);

// Modify cooldown keys
const cooldownKey = `${command.name}:${message.username}:${message.roomId}`;
```

### Command-Specific Concerns
- **Heist commands**: Need room-specific heist instances
- **Economy commands**: Balance is global but games are per-room
- **Counter commands**: Counts should be per-room
- **Stats commands**: Need room filtering options
- **Admin commands**: Room-specific permissions needed

## 5. Manager Pattern Refactoring

### Current State
- Singleton managers (HeistManager, VideoPayoutManager, etc.)
- Global state tracking within managers
- No room context in manager operations

### Required Changes
```javascript
// Option 1: Per-room manager instances
class RoomContext {
    constructor(roomName, bot) {
        this.heistManager = new HeistManager(bot.db, bot, roomName);
        this.videoPayoutManager = new VideoPayoutManager(bot.db, roomName);
        // ... other managers
    }
}

// Option 2: Room-aware singleton managers
class HeistManager {
    constructor(db, bot) {
        this.activeHeists = new Map(); // roomId -> heist state
    }
    
    async startHeist(roomId, starter) {
        const heist = this.activeHeists.get(roomId);
        // ... room-specific logic
    }
}
```

### Manager-Specific Concerns
- Memory usage multiplies with per-room instances
- Complex state synchronization for room-aware singletons
- Event emission needs room context
- Database queries need room filtering

## 6. Event System Architecture

### Current Event Flow
- Events have no room context
- Global event listeners
- No event isolation between rooms

### Required Changes
- Add room context to all events
- Implement room-specific event namespaces
- Prevent cross-room event pollution
- Update WebSocket broadcasting

### Event System Concerns
- Event listener memory leaks with multiple rooms
- Complex debugging of room-specific events
- Performance impact of event routing
- WebSocket broadcast efficiency

## 7. Web Interface Considerations

Given that the web interface will be shared across all rooms:

### API Modifications
```javascript
// Add room filtering to existing endpoints
GET /api/v1/stats/users?room=fatpizza
GET /api/v1/stats/messages?room=fatpizza&room=otherroom

// New room-specific endpoints
GET /api/v1/rooms - List all active rooms
GET /api/v1/rooms/:roomId/stats - Room-specific statistics
GET /api/v1/rooms/:roomId/users - Room user list
GET /api/v1/rooms/:roomId/activity - Room activity data

// WebSocket events need room context
{
    type: 'chat:message',
    room: 'fatpizza',
    data: { username, message, timestamp }
}
```

### UI/UX Considerations
- Room selector/filter in web interface
- Aggregate vs room-specific views
- Real-time updates from multiple rooms
- Performance with multiple room streams

## 8. Resource Usage and Scaling

### Memory Projections
- Base memory per room: 150-300KB
- Under load per room: 1-2MB
- 10 rooms: 10-20MB total
- 25 rooms: 25-50MB total
- 50 rooms: 50-100MB total (requires optimization)

### CPU Considerations
- Message processing is synchronous
- Regex operations on every message
- No worker pool for parallel processing
- Ollama AI responses are blocking

### Realistic Scaling Limits
- **Current Architecture**: 5-10 rooms maximum
- **With Optimizations**: 15-25 rooms
- **Major Refactor Required**: 30+ rooms

## 9. Security and Isolation

### Data Isolation Concerns
- Prevent cross-room message leaks
- Room-specific permission models
- Isolated error handling per room
- Secure room configuration storage

### Rate Limiting Challenges
- Per-room command limits
- Global user limits across rooms
- Prevent room abuse affecting others
- Fair resource allocation

### Authentication Issues
- Multiple bot accounts/credentials
- Room-specific admin rights
- Permission inheritance model
- Secure credential storage

## 10. Operational Challenges

### Monitoring Requirements
- Per-room metrics collection
- Aggregate health monitoring
- Room-specific error tracking
- Performance profiling per room

### Deployment Complexity
- Room-specific configurations
- Gradual rollout strategy
- Feature flags per room
- Database migration strategy

### Error Handling
- Room-level error boundaries
- Graceful room disconnection
- Prevent cascade failures
- Room-specific recovery

## 11. Implementation Phases

### Phase 1: Foundation (2-3 weeks)
1. Add room_id to database schema
2. Create room configuration system
3. Implement basic connection multiplexing
4. Add room context to events

### Phase 2: Core Refactoring (3-4 weeks)
1. Refactor state management for room isolation
2. Update command system with room context
3. Modify managers for multi-room support
4. Implement room-specific cooldowns

### Phase 3: API and Interface (1-2 weeks)
1. Add room filtering to API endpoints
2. Implement room-specific WebSocket namespaces
3. Create room management endpoints
4. Update event broadcasting

### Phase 4: Testing and Optimization (2-3 weeks)
1. Comprehensive multi-room testing
2. Performance optimization
3. Memory leak detection
4. Load testing with multiple rooms

### Phase 5: Production Readiness (1-2 weeks)
1. Monitoring implementation
2. Deployment procedures
3. Documentation updates
4. Gradual rollout plan

## 12. Alternative Approaches

### Option 1: Process Isolation (Recommended for Quick Implementation)
- Run separate bot instances per room
- Use process manager (PM2) for orchestration
- Shared database with room filtering
- Minimal code changes required

### Option 2: Microservice Architecture (Best for Scale)
- Room-specific microservices
- Message queue for coordination
- Distributed state management
- Horizontal scaling capability

### Option 3: Hybrid Approach
- Start with process isolation
- Gradually migrate to shared instance
- Maintain backward compatibility
- Incremental improvements

## 13. Risk Assessment

### High Risk Areas
1. **Database Performance**: SQLite limitations with concurrent writes
2. **Memory Leaks**: Complex state management across rooms
3. **Race Conditions**: Shared resource access between rooms
4. **Cascade Failures**: One room affecting others

### Mitigation Strategies
1. Consider PostgreSQL migration for better concurrency
2. Implement strict memory monitoring and cleanup
3. Use proper locking mechanisms for shared resources
4. Implement circuit breakers for room isolation

## 14. Success Criteria

### Functional Requirements
- [ ] Bot can join and maintain connections to multiple rooms
- [ ] Commands execute in correct room context
- [ ] No cross-room data leakage
- [ ] Web interface shows aggregated data

### Performance Requirements
- [ ] Support minimum 10 concurrent rooms
- [ ] Message processing latency < 100ms per room
- [ ] Memory usage < 2MB per room
- [ ] Database query performance maintained

### Operational Requirements
- [ ] Individual room monitoring
- [ ] Graceful room failure handling
- [ ] Easy room addition/removal
- [ ] Comprehensive logging

## Conclusion

Implementing multi-room support in the Dazza bot represents a significant architectural challenge. The current codebase has deep single-room assumptions throughout, affecting everything from connection management to state tracking to database queries. While technically feasible, this implementation would require approximately 11-16 weeks of focused development effort, extensive testing, and careful consideration of resource usage and scaling limits.

For immediate needs, running multiple bot instances with shared database access may provide a more practical solution while maintaining system stability and code simplicity.