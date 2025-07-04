# Archive Scripts Documentation

This directory contains utility scripts that were used for specific database maintenance or migration tasks. Most of these scripts are no longer needed as their functionality has been integrated into the main codebase or is no longer relevant.

## Script Analysis

### 1. cleanSystemUsers.js
**Purpose**: Removes system users (like [server], [voteskip], [playlist]) from the economy database.

**Status**: ✅ **Functionality exists in active code**
- The `isSystemUser()` function is now implemented in `src/modules/heist/HeistManager_multiroom.js`
- System user filtering is handled proactively to prevent system users from being added to the economy

**Recommendation**: **Can be deleted** - Active code prevents system users from entering the economy system.

---

### 2. fixDuplicateUsers.js
**Purpose**: Merges duplicate user entries that differ only in capitalization (e.g., "bob" and "Bob").

**Status**: ✅ **Functionality replaced by username normalization**
- The active codebase now uses `src/utils/usernameNormalizer.js` which provides:
  - `getCanonicalUsername()` - Gets the proper casing for usernames
  - `normalizeUsernameForDb()` - Ensures consistent username casing in database operations
  - Case-insensitive username matching throughout the application

**Recommendation**: **Keep for reference** - While no longer needed, it documents the historical duplicate user issue and could be useful if similar problems arise.

---

### 3. importHistoricalFishing.js
**Purpose**: Imports historical fishing data from log files into the economy_transactions table.

**Status**: ⚠️ **One-time migration script**
- Searches through log files for fishing catch messages
- Extracts weight, fish type, and value
- Imports into economy_transactions table
- The fishing system is now active and records catches directly

**Recommendation**: **Keep for reference** - May be useful if logs need to be re-imported or for understanding the fishing data structure.

---

### 4. mergeVideoWatchers.js
**Purpose**: Merges video watcher entries with different username casings and removes duplicate session entries.

**Status**: ✅ **Functionality replaced by username normalization**
- Uses the old `normalizeUsernameForDb` function (before the current implementation)
- The current system handles username normalization proactively

**Recommendation**: **Can be deleted** - Username normalization is now handled systematically.

---

### 5. normalizeUsernames.js
**Purpose**: Comprehensive script to normalize all usernames across all database tables to consistent casing.

**Status**: ✅ **Functionality replaced by active normalization system**
- The current `src/utils/usernameNormalizer.js` handles this proactively
- All new entries use normalized usernames
- The system maintains a canonical cache for performance

**Recommendation**: **Keep for reference** - Documents the comprehensive approach to fixing username inconsistencies across all tables.

---

### 6. populateLeaderboards.js
**Purpose**: Analyzes historical gambling and fishing data to populate leaderboards.

**Status**: ✅ **Functionality exists in active code**
- `getTopFishers()` and `getTopGamblers()` methods exist in the database service
- Leaderboards are now generated from live data
- Historical data has already been imported

**Recommendation**: **Can be deleted** - Leaderboards are now populated from live data.

---

### 7. testVideoPayoutReconciliation.js
**Purpose**: Tests the video payout reconciliation system to handle race conditions in userlist updates.

**Status**: ✅ **Test completed successfully**
- The reconciliation system is now implemented in `src/modules/video_payout/index.js`
- Includes `reconcileWatchers()` and scheduled reconciliation attempts
- Handles the race condition where userlist might be empty during media changes

**Recommendation**: **Can be deleted** - The tested functionality is now implemented and working in production.

---

## Summary

### Safe to Delete:
1. **cleanSystemUsers.js** - Functionality integrated into active code
2. **mergeVideoWatchers.js** - Replaced by proactive username normalization
3. **populateLeaderboards.js** - Leaderboards now use live data
4. **testVideoPayoutReconciliation.js** - Test completed, functionality implemented

### Keep for Reference:
1. **fixDuplicateUsers.js** - Documents historical duplicate user issues
2. **importHistoricalFishing.js** - May be needed for re-importing historical data
3. **normalizeUsernames.js** - Comprehensive documentation of username normalization approach

These reference scripts provide valuable documentation of past database issues and their solutions, which could be helpful for troubleshooting similar issues in the future.