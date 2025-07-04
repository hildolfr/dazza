# Room Configuration Guide

## Overview

The bot supports multiple rooms/channels on CyTube. Each room requires a configuration file in the `rooms/` directory.

## Directory Structure

```
dazza/
├── rooms/                  # Room configuration directory (auto-created if missing)
│   ├── example_room.js     # Example configuration (auto-created)
│   ├── fatpizza.js         # Your room configuration
│   └── another_room.js     # Another room configuration
└── index.js
```

## Creating a Room Configuration

1. **Create the rooms directory** (if it doesn't exist):
   ```bash
   mkdir rooms
   ```

2. **Create a room configuration file**:
   - Name format: `roomname.js` (lowercase, no spaces)
   - The filename should match the CyTube room name

3. **Room Configuration Format**:

```javascript
// rooms/example_room.js
export default {
    // Required: The exact room name on CyTube
    name: 'example_room',
    
    // Optional: Enable/disable the bot for this room
    enabled: true,
    
    // Optional: Room-specific settings
    settings: {
        // Custom welcome message
        welcomeMessage: 'Welcome to the example room!',
        
        // Command prefix (default: '!')
        commandPrefix: '!',
        
        // Enable/disable specific features
        features: {
            economy: true,
            fishing: true,
            heists: true,
            bongs: true
        }
    }
};
```

## Minimal Configuration

At minimum, a room configuration only needs:

```javascript
// rooms/myroom.js
export default {
    name: 'myroom'
};
```

## Adding Multiple Rooms

Simply create multiple configuration files:

```bash
rooms/
├── fatpizza.js
├── always_always_sunny.js
└── rifftrax_mst3k.js
```

The bot will automatically connect to all enabled rooms on startup.

## Auto-Population

If the `rooms/` directory doesn't exist when the bot starts, it will:
1. Create the `rooms/` directory
2. Generate `rooms/example_room.js` with a template configuration
3. Display a warning that no active rooms are configured

## Important Notes

- Room configuration files are **not** tracked by git (listed in .gitignore)
- Each developer/deployment needs their own room configurations
- Room names must match exactly with CyTube room names
- The bot will skip rooms with `enabled: false`

## Troubleshooting

- **Bot not connecting**: Check that the room name matches exactly
- **Commands not working**: Verify the commandPrefix setting
- **Features disabled**: Check the features object in settings