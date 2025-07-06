# Enhanced Winston Logger Migration Guide

## Overview
This guide explains how to migrate from the existing dual logging system to the new `EnhancedWinstonLogger` that combines Winston's professional logging capabilities with all bot-specific functionality.

## Key Features of EnhancedWinstonLogger

### ✅ **Preserved Functionality**
- All bot-specific methods: `command()`, `userEvent()`, `connection()`
- Circular reference handling for complex objects
- Daily log file rotation with size-based rotation
- Console and file output with proper formatting
- Child logger functionality
- API compatibility with existing usage patterns

### ⚡ **New Features**
- Winston's structured JSON logging
- Multiple transport support (console, file, error-only)
- Enhanced error handling with stack traces
- Configurable log levels and outputs
- Better performance and reliability
- Professional logging standards

## Migration Steps

### Step 1: Update Import Statements

**Before (Legacy Logger):**
```javascript
import { createLogger, getLogger } from './src/utils/logger.js';
```

**After (Enhanced Winston Logger):**
```javascript
import { createLogger, getLogger } from './src/utils/EnhancedWinstonLogger.js';
```

### Step 2: Update Logger Configuration (Optional)

**Legacy Configuration:**
```javascript
const logger = createLogger({
    logDir: './logs',
    maxFileSize: 200 * 1024, // 200KB
    maxFiles: 5,
    console: true,
    level: 'info'
});
```

**Enhanced Configuration (Backward Compatible):**
```javascript
const logger = createLogger({
    logDir: './logs',
    maxFileSize: 204800, // 200KB
    maxFiles: 5,
    console: true,
    level: 'info',
    colorize: true,        // NEW: Enable colorized output
    format: 'combined'     // NEW: Log format option
});
```

### Step 3: Verify Existing Usage Patterns

**All existing patterns continue to work:**
```javascript
// Standard logging methods
logger.info('Message', { context: 'data' });
logger.warn('Warning message');
logger.error('Error message', errorObject);
logger.debug('Debug message');

// Bot-specific methods
logger.command('username', 'command', ['arg1', 'arg2']);
logger.userEvent('username', 'join');
logger.connection('established', { host: 'example.com' });

// Child logger
const childLogger = logger.child({ module: 'test' });
childLogger.info('Child message');
```

## File-by-File Migration Checklist

### Core Files (Priority 1)
- [ ] `src/core/bot.js` - Main bot class
- [ ] `src/core/MultiRoomBot.js` - Multi-room functionality
- [ ] `src/services/database.js` - Database service
- [ ] `index.js` - Application entry point

### Module Files (Priority 2)
- [ ] `src/modules/heist/HeistManager.js` - Economy module
- [ ] `src/modules/video_payout/VideoPayoutManager.js` - Video payout
- [ ] `src/utils/memoryManager.js` - Memory management
- [ ] All command modules in `src/commands/`

### Utility Files (Priority 3)
- [ ] Batch job files
- [ ] Migration scripts
- [ ] Test files

## Configuration Examples

### Basic Configuration
```javascript
const logger = createLogger({
    logDir: './logs',
    level: 'info',
    console: true
});
```

### Production Configuration
```javascript
const logger = createLogger({
    logDir: './logs',
    maxFileSize: 204800,  // 200KB
    maxFiles: 10,
    console: false,       // Disable console in production
    level: 'warn',        // Only warn and error in production
    colorize: false,      // Disable colors in production
    format: 'json'        // Structured JSON for log analysis
});
```

### Development Configuration
```javascript
const logger = createLogger({
    logDir: './logs',
    maxFileSize: 1024,    // 1KB for faster rotation in dev
    maxFiles: 3,
    console: true,
    level: 'debug',       // All levels in development
    colorize: true,       // Colorized output for better readability
    format: 'combined'    // Human-readable format
});
```

## Log Output Changes

### Console Output
**Before:**
```
[2025-07-06T15:55:02.408Z] [INFO] Message {"context":"data"}
```

**After:**
```
[2025-07-06T15:55:02.408Z] [INFO] Message {"context":"data"}
```
*Note: Console output format remains the same for compatibility*

### File Output
**Before (Plain Text):**
```
[2025-07-06T15:55:02.408Z] [INFO] Message {"context":"data"}
```

**After (Structured JSON):**
```json
{"level":"info","message":"Message","context":"data","timestamp":"2025-07-06T15:55:02.408Z"}
```

### Bot-Specific Methods Output
**Command Logging:**
```json
{
  "level": "info",
  "message": "Command executed",
  "type": "command",
  "user": "dazza",
  "command": "bong",
  "args": ["count"],
  "timestamp": 1751817302410
}
```

**User Event Logging:**
```json
{
  "level": "info",
  "message": "User join",
  "type": "user_event",
  "user": "shazza",
  "event": "join",
  "timestamp": 1751817302410
}
```

**Connection Logging:**
```json
{
  "level": "info",
  "message": "Connection established",
  "type": "connection",
  "event": "established",
  "host": "cytu.be",
  "port": 443,
  "timestamp": 1751817302410
}
```

## Testing Your Migration

### 1. Run the Test Suite
```bash
node test-enhanced-winston-logger.js
```

### 2. Run the Demonstration
```bash
node demo-enhanced-winston-logger.js
```

### 3. Check Log Files
After migration, verify that:
- Daily log files are created with format: `cytube-bot-YYYY-MM-DD.log`
- Error-only log file is created: `error.log`
- JSON format is properly structured
- All bot-specific methods are logging correctly

## Benefits of Migration

### 1. **Unified Logging System**
- Single logger implementation to maintain
- Consistent API across the entire codebase
- No more confusion about which logger to use

### 2. **Better Performance**
- Winston's optimized transport system
- Async logging capabilities
- Efficient file rotation and management

### 3. **Enhanced Debugging**
- Structured JSON logs for better parsing
- Enhanced error handling with stack traces
- Multiple log levels for different environments

### 4. **Professional Standards**
- Industry-standard logging library (Winston)
- Extensive configuration options
- Better monitoring and alerting capabilities

### 5. **Future-Proof**
- Easy integration with log aggregation systems
- Support for multiple output formats
- Extensible transport system

## Troubleshooting

### Common Issues

**Issue: Log files not being created**
- Check directory permissions
- Verify `logDir` path is correct
- Ensure parent directories exist

**Issue: Circular reference errors**
- The logger handles circular references automatically
- Check for deeply nested objects that might cause stack overflow

**Issue: Log level not working**
- Verify log level is set correctly
- Check if transports have different log levels
- Use `isLevelEnabled()` to debug

### Validation Steps

1. **Test all bot-specific methods:**
   ```javascript
   logger.command('test', 'test', []);
   logger.userEvent('test', 'test');
   logger.connection('test', {});
   ```

2. **Test circular reference handling:**
   ```javascript
   const obj = { name: 'test' };
   obj.self = obj;
   logger.info('Test', obj);
   ```

3. **Test error handling:**
   ```javascript
   try {
     throw new Error('Test error');
   } catch (error) {
     logger.error('Test error', error);
   }
   ```

## Rollback Plan

If issues arise, you can quickly rollback:

1. **Revert import statements:**
   ```javascript
   // Change back to legacy logger
   import { createLogger, getLogger } from './src/utils/logger.js';
   ```

2. **Keep both loggers available during transition:**
   ```javascript
   // Use both loggers temporarily
   import { createLogger as createLegacyLogger } from './src/utils/logger.js';
   import { createLogger as createEnhancedLogger } from './src/utils/EnhancedWinstonLogger.js';
   ```

3. **Gradual migration approach:**
   - Migrate one module at a time
   - Test thoroughly before proceeding
   - Keep logs from both systems for comparison

## Support

For issues or questions during migration:
1. Check the test suite for examples
2. Review the demonstration script
3. Examine the comprehensive JSDoc documentation
4. Test with minimal configuration first

---

**Migration Status:** Ready for implementation
**Compatibility:** 100% backward compatible
**Performance Impact:** Improved performance with Winston optimizations
**Risk Level:** Low (comprehensive testing completed)