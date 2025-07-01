# Multi-Room Implementation Status Document

**Date**: 2025-01-07  
**Branch**: multiroom-refactor  
**Status**: Foundation Complete, Activation Pending

## Overview

This document provides a comprehensive record of the multi-room support implementation for the Dazza bot. The implementation allows a single bot instance to connect to multiple CyTube rooms simultaneously while maintaining global economy and preventing cross-room exploitation.

## Design Decisions Made

1. **Single Bot Instance**: One bot process manages all room connections
2. **Global Economy**: User balances, stats, and gallery are shared across all rooms
3. **Room-Specific Interactions**: Heists, messages, and events are room-isolated
4. **Anti-Cheat**: Heists are global (one at a time) but participation is room-specific
5. **Database**: SQLite with room_id columns added to relevant tables
6. **Target Rooms**: Initial support for `fatpizza` and `always_always_sunny`

## Completed Implementation

### 1. Database Schema Changes

#### Migration File Created
- **File**: `src/database/migrations/002_add_room_support.js.disabled`
- **Status**: Created but disabled (needs `.disabled` removed to activate)
- **Changes**:
  - Creates `rooms` table for room tracking
  - Creates `room_user_presence` table for per-room user tracking
  - Adds `room_id` column to 14 tables with DEFAULT 'fatpizza'
  - Updates primary keys for `bong_counter` and `drink_counter` to include room_id
  - Creates composite indexes for all room-based queries

#### Database Module Updates
- **File**: `src/services/database.js`
- **Backup**: `src/services/database_backup.js` (original version preserved)
- **Changes**:
  - All logging methods now accept `roomId` parameter:
    - `logMessage(username, message, roomId)`
    - `logUserEvent(username, eventType, roomId)`
    - `logUserBong(username, roomId)`
    - `logUserDrink(username, roomId)`
    - `logUrl(username, urlData, messageId, roomId)`
  - All query methods support optional `roomId` filtering:
    - `getRecentMessages(limit, roomId)`
    - `getBongCount(date, roomId)`
    - `getTopTalkers(limit, roomId)`
    - etc.
  - Counter methods handle room-specific counts:
    - `incrementBongCount(date, roomId)`
    - `incrementDrinkCount(date, roomId)`
  - Tell/reminder methods include room context:
    - `addReminder(fromUser, toUser, message, remindAt, roomId)`
    - `addTell(fromUser, toUser, message, viaPm, roomId)`

### 2. Core Architecture

#### RoomContext Class
- **File**: `src/RoomContext.js`
- **Purpose**: Manages state for a specific room
- **State Tracked**:
  - `userlist` - Map of users in the room
  - `currentMedia` - Currently playing media
  - `playlist` - Room playlist
  - `messageHistory` - Last 100 messages
  - `processedMessages` - Deduplication set
  - `lastGreetings` - Per-user greeting cooldowns
  - `pendingGreetings` - Scheduled greetings
  - Various cooldown timers
- **Methods**:
  - `getUser(username)` - Case-insensitive user lookup
  - `hasUser(username)` - Check user presence
  - `addToMessageHistory(username, message)`
  - `clearNonEssentialCaches()` - Memory management
  - `getStats()` - Room statistics
  - `cleanup()` - Resource cleanup

#### MultiRoomBot Class
- **File**: `src/core/MultiRoomBot.js`
- **Purpose**: Main bot class managing multiple rooms
- **Key Features**:
  - Manages multiple `CyTubeConnection` instances
  - Maintains `rooms` Map (roomId -> RoomContext)
  - Global services shared across rooms (db, personality, managers)
  - Room-specific event routing
  - Exported as `CyTubeBot` for backward compatibility
- **Methods**:
  - `loadRooms()` - Loads room configs from `rooms/` directory
  - `joinRoom(roomId, roomConfig)` - Joins a specific room
  - `leaveRoom(roomId)` - Leaves a room
  - `sendMessage(roomId, message)` - Send to specific room
  - `executeCommand(roomId, commandName, message, args)`

#### Connection Updates
- **File**: `src/core/connection.js`
- **Change**: Constructor now accepts `roomId` as first parameter
- **Usage**: `new CyTubeConnection(roomId, config)`

### 3. Room Configuration

#### Room Config Directory
- **Location**: `rooms/`
- **Format**: Individual JS files per room
- **Files Created**:
  - `rooms/fatpizza.js`
  - `rooms/always_always_sunny.js`
- **Structure**:
```javascript
module.exports = {
    channel: 'roomname',
    enabled: true,
    // Room-specific overrides can be added
}
```

### 4. Event Handling System

#### Room Event Handlers
- **File**: `src/core/roomEventHandlers.js`
- **Purpose**: Mixin providing room-aware event handling
- **Handlers Implemented**:
  - `handleUserlist(roomId, users)`
  - `handleUserJoin(roomId, user)`
  - `handleUserLeave(roomId, data)`
  - `handleChatMessage(roomId, data)`
  - `handlePrivateMessage(roomId, data)`
  - `handleMediaChange(roomId, media)`
  - `checkAndGreetUser(roomId, user)`
  - `checkAndDeliverTells(roomId, username)`
  - `checkAndCommentOnUrl(roomId, data)`
  - `checkAndStoreImages(roomId, data)`
  - `checkForMentions(roomId, data)`

#### Event Flow
1. Connection receives event
2. MultiRoomBot routes to appropriate handler with roomId
3. Handler updates room-specific state
4. Database operations include roomId
5. Responses sent only to originating room

### 5. HeistManager Multi-Room Support

#### New HeistManager
- **File**: `src/modules/heist/HeistManager_multiroom.js`
- **Key Changes**:
  - Tracks activity per room in `roomStates` Map
  - `currentHeistRoom` tracks where active heist started
  - Only accepts votes from the heist room
  - Announces/returns only in originating room
  - Payouts only to participants from that room
- **New Methods**:
  - `getRoomState(roomId)` - Get or create room state
  - `trackActivity(username, roomId)` - Per-room activity
  - `checkVote(username, message, roomId)` - Vote parsing

#### Heist Event Handlers
- **File**: `src/core/heistEventHandlers.js`
- **Purpose**: Routes HeistManager events to correct rooms
- **Events Handled**:
  - `announce` → `bot.sendMessage(data.roomId, data.message)`
  - `depart` → Room-specific departure message
  - `return` → Room-specific return message
  - `payout` → Room-specific payout announcements

### 6. Schema Compatibility Fixes

During implementation, we discovered schema format mismatches. Created compatibility files:

#### Files Created
- `src/modules/heist/schema_compat.js`
- `src/modules/video_payout/schema_compat.js`
- `src/utils/cooldownSchema_compat.js`

These ensure the bot can start with existing database structure.

## Pending Implementation

### 1. Enable Migration ⚠️ CRITICAL

**Action Required**: 
```bash
# Rename to enable
mv src/database/migrations/002_add_room_support.js.disabled \
   src/database/migrations/002_add_room_support.js
```

**Warning**: This will modify the database. Backup first!

### 2. Activate MultiRoomBot ⚠️ CRITICAL

**File**: `index.js`
**Current Import**:
```javascript
import { CyTubeBot } from './src/core/bot.js';
```
**Change To**:
```javascript
import { CyTubeBot } from './src/core/MultiRoomBot.js';
```

### 3. Update Command System

#### Add Room Context to Command Execution
**File**: `src/commands/registry.js`
**Method**: `execute()`
**Current**:
```javascript
async execute(commandName, bot, message, args)
```
**Needs**: Room context from message object

#### Add Room Filtering to Commands
**Example Command Update**:
```javascript
// In any command file
module.exports = {
    name: 'example',
    rooms: [], // Empty = all rooms
    // OR
    rooms: ['fatpizza'], // Specific rooms only
    // ... rest of command
}
```

### 4. Update Remaining Managers

#### VideoPayoutManager
- Add room tracking for video queues
- Route payout messages to correct room
- Update database calls with roomId

#### PissingContestManager  
- Add room context to challenges
- Ensure challenges are room-specific

### 5. Update Command Categories

Commands needing room context updates:

#### Economy Commands
- All heist-related commands (they reference `bot.heistManager`)
- Challenge commands (coin flip, pissing contest)
- Any command that sends messages

#### Communication Commands
- `remind.js` - needs to pass roomId to addReminder
- `tell.js` - needs to pass roomId to addTell

#### Stats Commands
- Add optional room filtering
- Update display to show room context where relevant

### 6. API Updates (Lower Priority)

#### Endpoints Needing Room Support
- `/api/v1/stats/*` - Add optional room query parameter
- `/api/v1/messages` - Add room filtering
- `/api/v1/gallery` - Remains global (no changes)

#### WebSocket Events
- Add `roomId` to all emitted events
- Update event consumers to handle room context

### 7. Testing Requirements

Before going live:

1. **Database Migration Test**
   - Backup database
   - Run migration
   - Verify all tables have room_id
   - Test rollback procedure

2. **Multi-Room Connection Test**
   - Start bot with both rooms enabled
   - Verify independent connections
   - Test reconnection per room

3. **Heist System Test**
   - Start heist in room A
   - Verify room B doesn't see it
   - Test voting isolation
   - Verify payouts only to room A

4. **Command Test**
   - Test commands in each room
   - Verify room filtering works
   - Test tell delivery across rooms

## Known Issues

1. **Schema Format**: We had to create compatibility schemas due to format mismatch
2. **Migration Disabled**: The migration is created but disabled for safety
3. **Command Updates**: Most commands don't pass roomId yet
4. **Manager Updates**: Only HeistManager is fully room-aware

## Rollback Plan

If issues arise:

1. **Git Rollback**:
   ```bash
   git checkout main
   ```

2. **Database Rollback**:
   - Restore from backup
   - OR manually remove room_id columns

3. **Quick Fix**:
   - Keep using original `CyTubeBot` class
   - Disable room loading in config

## Next Session Checklist

When resuming work:

- [ ] Review this document
- [ ] Check current branch: `git branch`
- [ ] Verify changes: `git status`
- [ ] Enable migration file
- [ ] Switch to MultiRoomBot in index.js
- [ ] Run migration
- [ ] Test basic functionality
- [ ] Update remaining commands
- [ ] Full testing

## File Inventory

### New Files Created
- `/rooms/fatpizza.js`
- `/rooms/always_always_sunny.js`
- `/src/RoomContext.js`
- `/src/core/MultiRoomBot.js`
- `/src/core/roomEventHandlers.js`
- `/src/core/heistEventHandlers.js`
- `/src/database/migrations/002_add_room_support.js.disabled`
- `/src/modules/heist/HeistManager_multiroom.js`
- `/src/modules/heist/schema_compat.js`
- `/src/modules/video_payout/schema_compat.js`
- `/src/utils/cooldownSchema_compat.js`

### Modified Files
- `/src/core/connection.js` - Added roomId parameter
- `/src/services/database.js` - Added room support to all methods
- `/src/modules/heist/schema.js` - Minor updates
- Various schema files for compatibility

### Backup Files
- `/src/services/database_backup.js` - Original database.js

## Summary

The multi-room foundation is complete and committed to the `multiroom-refactor` branch. The architecture is sound and follows all design requirements. The main work remaining is enabling the changes and updating individual commands to pass room context. The system prevents cross-room cheating while maintaining the global economy as specified.