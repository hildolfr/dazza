# Unfinished Modularization Tasks

## Overview
This document tracks all features, systems, and components that have not yet been converted to the new modular architecture.

## ✅ Completed Modules (3)

### Core Infrastructure
- [x] **core-database** - Database connection and query management
- [x] **core-api** - HTTP/WebSocket server for external access  
- [x] **core-connection** - CyTube websocket connection manager

## ❌ Unconverted Systems

### 1. Main Bot System (Critical Priority)
**Location:** `src/core/bot.js`
**Status:** Monolithic 2300+ line file
**Dependencies:** Everything depends on this
**Conversion Effort:** 7-10 days

Key functionality to extract:
- Message handling and routing
- User management
- Room state management
- Permission system
- Event coordination
- Core bot commands

### 2. Command System (High Priority)
**Location:** `src/commands/`
**Status:** 60+ individual command files
**Conversion Effort:** 3-5 days

Categories to convert:
- **admin/** (10 commands) - Bot administration
- **economy/** (17 commands) - Virtual currency system
- **fun/** (15 commands) - Entertainment commands  
- **games/** (8 commands) - Game commands
- **info/** (7 commands) - Information commands
- **media/** (4 commands) - Media control

Each command needs:
- Conversion to module format
- Permission integration
- Help text migration
- Cooldown system integration

### 3. Background Services (High Priority)
**Location:** `src/services/`
**Status:** 13 service files
**Conversion Effort:** 5-7 days

Services to modularize:
- [ ] **apiService.js** - External API management
- [ ] **backgroundTaskService.js** - Task scheduling
- [ ] **batchService.js** - Batch job processing
- [ ] **database.js** - Old database layer (migrate to core-database)
- [ ] **greetingService.js** - User greeting system
- [ ] **leaderboardService.js** - Stats and rankings
- [ ] **mediaAnalyzer.js** - Media metadata extraction
- [ ] **ollamaService.js** - AI integration
- [ ] **pmService.js** - Private message handling
- [ ] **processManager.js** - Child process management
- [ ] **rateLimiter.js** - Rate limiting
- [ ] **webSocketManager.js** - WebSocket connections
- [ ] **weatherService.js** - Weather data integration

### 4. Game Systems (Medium Priority)
**Location:** `src/modules/`
**Status:** Partially modularized
**Conversion Effort:** 2-3 days

Games to convert:
- [ ] **heist/** - Multiplayer heist game (partially done)
- [ ] **pissingContest/** - Competition game
- [ ] **videoPayout/** - Media reward system

### 5. Batch Processing System (Medium Priority)
**Location:** `src/batch/`
**Status:** 6 batch job files
**Conversion Effort:** 2-3 days

Jobs to convert:
- [ ] **dailyAnalytics.js** - Daily stats compilation
- [ ] **databaseMaintenance.js** - DB optimization
- [ ] **mediaHealthCheck.js** - Media validation
- [ ] **statsAggregator.js** - Statistics processing
- [ ] **userAnalytics.js** - User behavior analysis
- [ ] **videoAnalytics.js** - Video stats tracking

### 6. API Routes & Middleware (Low Priority)
**Location:** `src/api/`
**Status:** Multiple route files
**Conversion Effort:** 2-3 days

Routes to migrate:
- [ ] **middleware/** - Auth, CORS, error handling
- [ ] **routes/** - Stats, leaderboard, user endpoints
- [ ] **app.js** - Express configuration

### 7. Utility Systems (Low Priority)
**Location:** `src/utils/`
**Status:** 20+ utility files
**Conversion Effort:** 3-4 days

Key utilities to evaluate:
- Message formatting and validation
- Cooldown management
- Memory monitoring
- URL/Image detection
- Username normalization

## 🚨 Architecture Conflicts

### Duplicate Systems
1. **Database Access**
   - Old: `src/services/database.js`
   - New: `src/modules/core-database/`
   - Action: Migrate all database calls to core-database

2. **API Server**
   - Old: `src/api/app.js`
   - New: `src/modules/core-api/`
   - Action: Migrate routes to core-api module

3. **Logging**
   - Old: `src/utils/logger.js` (ES6)
   - New: `src/utils/createLogger.js` (CommonJS)
   - Action: Standardize on winston-based logger

### Import Pattern Issues
- Mixed ES6 imports and CommonJS requires
- Need to standardize on CommonJS for consistency
- ~40 files need import conversion

## 📋 Recommended Conversion Order

### Phase 1: Foundation (Week 1)
1. **Command Handler Module** - Central command routing system
2. **Permission Module** - User permission management
3. **Cooldown Module** - Command cooldown system

### Phase 2: Core Features (Week 2)
4. **Economy Module** - Virtual currency system
5. **Greeting Module** - User join/leave messages
6. **Stats Module** - Statistics collection

### Phase 3: Games & Entertainment (Week 3)
7. **Heist Module** - Complete modularization
8. **Games Module** - Other game systems
9. **Media Module** - Media rewards and tracking

### Phase 4: Services (Week 4)
10. **Batch Module** - Scheduled batch jobs
11. **Analytics Module** - Data analysis
12. **AI Module** - Ollama integration

### Phase 5: Cleanup (Week 5)
13. **Bot Refactor** - Break up monolithic bot.js
14. **Migration Cleanup** - Remove old systems
15. **Documentation** - Update all docs

## 📊 Progress Tracking

```
Core Infrastructure: ████████████████████ 100% (8/8 modules)
Core Modules:        ██████░░░░░░░░░░░░░░  30% (3/10 modules)
Feature Modules:     ░░░░░░░░░░░░░░░░░░░░   0% (0/15 modules)
Cleanup:             ░░░░░░░░░░░░░░░░░░░░   0% (0/5 tasks)

Overall Progress:    ████░░░░░░░░░░░░░░░░  20% (11/38 tasks)
```

## 🔧 Technical Debt

### High Priority
- Remove circular dependencies between bot.js and services
- Standardize error handling across all modules
- Implement proper TypeScript types (if migrating to TS)

### Medium Priority
- Consolidate duplicate utility functions
- Standardize configuration format
- Improve test coverage for modules

### Low Priority
- Remove unused dependencies
- Update documentation
- Optimize database queries

## 📝 Module Template

Each new module should follow this structure:
```
src/modules/<module-name>/
├── module.json         # Module manifest
├── index.js           # Module entry point
├── services/          # Module-specific services
├── commands/          # Module commands (if applicable)
└── README.md          # Module documentation
```

## 🚀 Next Steps

1. Start with **command-handler** module (highest impact, most self-contained)
2. Create standardized module templates
3. Set up automated testing for modules
4. Plan gradual migration to avoid breaking changes
5. Document migration patterns for consistency

## 📅 Estimated Timeline

- **Total Effort:** 25-35 days
- **With Parallel Work:** 15-20 days (2-3 developers)
- **Single Developer:** 30-40 days

## 🎯 Success Criteria

- [ ] All commands converted to modules
- [ ] No direct database access outside core-database
- [ ] All scheduled tasks use UnifiedScheduler
- [ ] Bot.js reduced to <200 lines
- [ ] All tests passing
- [ ] Zero duplicate code between old/new systems
- [ ] Documentation updated
- [ ] Hot-reload working for all feature modules