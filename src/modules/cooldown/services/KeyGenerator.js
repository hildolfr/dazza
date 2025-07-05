class KeyGenerator {
    constructor() {
        this.separator = ':';
    }

    /**
     * Generate a standardized cooldown key
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @param {string} roomId - The room ID (optional)
     * @returns {string} - Standardized cooldown key
     */
    generate(commandName, username, roomId = 'fatpizza') {
        // Normalize components
        const normalizedCommand = this.normalizeCommand(commandName);
        const normalizedUsername = this.normalizeUsername(username);
        const normalizedRoomId = this.normalizeRoomId(roomId);

        return `${normalizedCommand}${this.separator}${normalizedUsername}${this.separator}${normalizedRoomId}`;
    }

    /**
     * Parse a cooldown key back into components
     * @param {string} key - The cooldown key
     * @returns {object} - Object with commandName, username, roomId
     */
    parse(key) {
        const parts = key.split(this.separator);
        
        if (parts.length < 2) {
            throw new Error(`Invalid cooldown key format: ${key}`);
        }

        return {
            commandName: parts[0],
            username: parts[1],
            roomId: parts[2] || 'fatpizza'
        };
    }

    /**
     * Generate a key for legacy compatibility (without room)
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @returns {string} - Legacy format cooldown key
     */
    generateLegacy(commandName, username) {
        const normalizedCommand = this.normalizeCommand(commandName);
        const normalizedUsername = this.normalizeUsername(username);

        return `${normalizedCommand}${this.separator}${normalizedUsername}`;
    }

    /**
     * Generate a pattern for matching keys
     * @param {string} commandName - The command name (optional)
     * @param {string} username - The username (optional)
     * @param {string} roomId - The room ID (optional)
     * @returns {string} - Pattern for matching
     */
    generatePattern(commandName = null, username = null, roomId = null) {
        const cmdPart = commandName ? this.normalizeCommand(commandName) : '*';
        const userPart = username ? this.normalizeUsername(username) : '*';
        const roomPart = roomId ? this.normalizeRoomId(roomId) : '*';

        return `${cmdPart}${this.separator}${userPart}${this.separator}${roomPart}`;
    }

    /**
     * Check if a key matches a pattern
     * @param {string} key - The key to check
     * @param {string} pattern - The pattern to match against
     * @returns {boolean} - True if matches
     */
    matchesPattern(key, pattern) {
        const keyParts = key.split(this.separator);
        const patternParts = pattern.split(this.separator);

        if (keyParts.length !== patternParts.length) {
            return false;
        }

        for (let i = 0; i < keyParts.length; i++) {
            if (patternParts[i] !== '*' && patternParts[i] !== keyParts[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get all keys for a specific user
     * @param {string} username - The username
     * @param {string} roomId - The room ID (optional)
     * @returns {string} - Pattern for user's keys
     */
    getUserPattern(username, roomId = null) {
        return this.generatePattern(null, username, roomId);
    }

    /**
     * Get all keys for a specific command
     * @param {string} commandName - The command name
     * @param {string} roomId - The room ID (optional)
     * @returns {string} - Pattern for command's keys
     */
    getCommandPattern(commandName, roomId = null) {
        return this.generatePattern(commandName, null, roomId);
    }

    /**
     * Get all keys for a specific room
     * @param {string} roomId - The room ID
     * @returns {string} - Pattern for room's keys
     */
    getRoomPattern(roomId) {
        return this.generatePattern(null, null, roomId);
    }

    /**
     * Normalize command name
     * @param {string} commandName - The command name
     * @returns {string} - Normalized command name
     */
    normalizeCommand(commandName) {
        if (typeof commandName !== 'string') {
            throw new Error('Command name must be a string');
        }
        return commandName.toLowerCase().trim();
    }

    /**
     * Normalize username
     * @param {string} username - The username
     * @returns {string} - Normalized username
     */
    normalizeUsername(username) {
        if (typeof username !== 'string') {
            throw new Error('Username must be a string');
        }
        return username.toLowerCase().trim();
    }

    /**
     * Normalize room ID
     * @param {string} roomId - The room ID
     * @returns {string} - Normalized room ID
     */
    normalizeRoomId(roomId) {
        if (typeof roomId !== 'string') {
            throw new Error('Room ID must be a string');
        }
        return roomId.toLowerCase().trim();
    }

    /**
     * Validate key format
     * @param {string} key - The key to validate
     * @returns {boolean} - True if valid format
     */
    isValidKey(key) {
        try {
            const parsed = this.parse(key);
            return !!(parsed.commandName && parsed.username);
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract room ID from key
     * @param {string} key - The cooldown key
     * @returns {string|null} - Room ID or null if not found
     */
    extractRoomId(key) {
        try {
            const parsed = this.parse(key);
            return parsed.roomId;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract username from key
     * @param {string} key - The cooldown key
     * @returns {string|null} - Username or null if not found
     */
    extractUsername(key) {
        try {
            const parsed = this.parse(key);
            return parsed.username;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract command name from key
     * @param {string} key - The cooldown key
     * @returns {string|null} - Command name or null if not found
     */
    extractCommandName(key) {
        try {
            const parsed = this.parse(key);
            return parsed.commandName;
        } catch (error) {
            return null;
        }
    }

    /**
     * Convert legacy key format to new format
     * @param {string} legacyKey - The legacy key (command:username)
     * @param {string} roomId - The room ID to add
     * @returns {string} - New format key
     */
    migrateLegacyKey(legacyKey, roomId = 'fatpizza') {
        const parts = legacyKey.split(this.separator);
        if (parts.length === 2) {
            return this.generate(parts[0], parts[1], roomId);
        }
        throw new Error(`Invalid legacy key format: ${legacyKey}`);
    }
}

export default KeyGenerator;