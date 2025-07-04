# Note on Console Statements in Scripts

The following script files intentionally use console statements instead of logger:

## Migration Scripts
- `migrate.js` - CLI migration tool
- `fillMissingPissingData.js` - One-time data migration script
- `updatePissingAnalytics.js` - Analytics update script

## Reasoning
These are standalone CLI scripts that:
1. Run independently of the main bot application
2. Need direct console output for user feedback
3. Are meant to be run manually by developers/administrators
4. Display progress, results, and errors directly to the terminal

Using console statements in these contexts is appropriate as they are not part of the running application but rather maintenance tools that need immediate visual feedback.

## Best Practice
For CLI scripts:
- Use `console.log()` for informational output
- Use `console.error()` for error messages
- Use `console.table()` for tabular data display
- Include clear progress indicators for long-running operations

For application code:
- Always use the logger instance
- Never use console statements in production code
- Pass logger instances through constructors/functions as needed