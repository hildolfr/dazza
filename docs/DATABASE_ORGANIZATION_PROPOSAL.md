# Database File Organization Proposal

## Current State
- `cytube_stats.db` (2.0 MB) - Main application database in root directory
- `media_encountered.db` (84 KB) - Media tracking database in root directory

## Analysis

### File References
The following files directly reference database paths:
1. **Config-based** (1 file):
   - `src/config/index.js` - Defines `database.path`

2. **Direct string references** (7 files):
   - `src/utils/migrateBongData.js`
   - `src/batch/monitorWordCount.js`
   - `src/batch/runWordCount.js`
   - `src/modules/media/MediaTracker.js`
   - `src/scripts/fillMissingPissingData.js`
   - `src/scripts/updatePissingAnalytics.js`
   - `src/scripts/migrate.js`

### Pros of Current Organization
1. **Simple** - Databases are easy to find in root
2. **Backup-friendly** - Easy to identify and backup both .db files
3. **Standard practice** - Many applications keep SQLite databases in root

### Cons of Current Organization
1. **Root clutter** - Adds files to root directory
2. **No clear data directory** - Mixed with code files
3. **Inconsistent paths** - Some use config, others hardcode

## Recommendation: Keep Current Structure

### Reasoning
1. **Low impact** - Only 2 database files, not excessive clutter
2. **Working system** - Current setup works without issues
3. **Refactoring risk** - Would require updating 8 files with potential for errors
4. **Backup clarity** - Easy to identify .db files for backup scripts

### Alternative Improvements (Lower Risk)
Instead of moving files, consider:

1. **Centralize path configuration**:
   ```javascript
   // config/index.js
   database: {
       main: path.join(rootDir, 'cytube_stats.db'),
       media: path.join(rootDir, 'media_encountered.db')
   }
   ```

2. **Update hardcoded references** to use config:
   - Update the 7 files to import and use config paths
   - This provides flexibility without moving files

3. **Add to .gitignore** (if not already):
   ```
   *.db
   *.db-journal
   *.db-wal
   ```

4. **Document in README**:
   ```markdown
   ## Database Files
   - `cytube_stats.db` - Main application database
   - `media_encountered.db` - Media tracking database
   ```

## Future Consideration
If the project grows to have many more database files (5+), revisit this decision and create a `data/` directory structure:
```
data/
├── databases/
│   ├── cytube_stats.db
│   └── media_encountered.db
├── backups/
└── exports/
```

## Conclusion
The current structure is adequate for 2 database files. Focus efforts on more impactful improvements like centralizing configuration rather than restructuring file locations.