export class ConfigValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    validate(config) {
        this.errors = [];
        this.warnings = [];

        // Required fields
        this.requireField(config, 'bot.name', 'string');
        this.requireField(config, 'cytube.url', 'string');
        this.requireField(config, 'cytube.channel', 'string');
        this.requireField(config, 'database.path', 'string');

        // Optional but recommended
        if (!config.bot?.username) {
            this.warnings.push('bot.username not set - bot will run in anonymous mode');
        }
        if (!config.bot?.password) {
            this.warnings.push('bot.password not set - bot will run in anonymous mode');
        }

        // Validate URLs
        if (config.cytube?.url && !this.isValidUrl(config.cytube.url)) {
            this.errors.push('cytube.url must be a valid URL');
        }

        // Validate numeric values
        this.validateNumber(config, 'cooldowns.default', 0, 60000);
        this.validateNumber(config, 'cooldowns.bong', 0, 600000);
        this.validateNumber(config, 'cooldowns.tell', 0, 60000);
        this.validateNumber(config, 'greeting.cooldown', 0, 86400000);
        this.validateNumber(config, 'reminder.checkInterval', 10000, 600000);
        this.validateNumber(config, 'reminder.maxDuration', 60000, 86400000);

        // Validate arrays
        if (config.admins && !Array.isArray(config.admins)) {
            this.errors.push('admins must be an array of usernames');
        }

        // Check for environment variables if credentials are missing
        if (!config.bot?.username && !process.env.BOT_USERNAME) {
            this.warnings.push('No bot username configured (set bot.username or BOT_USERNAME env var)');
        }

        return {
            valid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    requireField(obj, path, type) {
        const value = this.getValueByPath(obj, path);
        
        if (value === undefined || value === null) {
            this.errors.push(`Required field '${path}' is missing`);
            return false;
        }

        if (type && typeof value !== type) {
            this.errors.push(`Field '${path}' must be of type ${type}, got ${typeof value}`);
            return false;
        }

        return true;
    }

    validateNumber(obj, path, min, max) {
        const value = this.getValueByPath(obj, path);
        
        if (value === undefined) return; // Optional field

        if (typeof value !== 'number') {
            this.errors.push(`Field '${path}' must be a number`);
            return;
        }

        if (min !== undefined && value < min) {
            this.errors.push(`Field '${path}' must be at least ${min}`);
        }

        if (max !== undefined && value > max) {
            this.errors.push(`Field '${path}' must be at most ${max}`);
        }
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    printReport(logger = null) {
        // Use provided logger or fall back to console for CLI usage
        const log = logger || {
            error: (...args) => console.error(...args),
            warn: (...args) => console.warn(...args),
            info: (...args) => console.log(...args)
        };

        if (this.errors.length > 0) {
            log.error('\n❌ Configuration Errors:');
            this.errors.forEach(error => log.error(`   - ${error}`));
        }

        if (this.warnings.length > 0) {
            log.warn('\n⚠️  Configuration Warnings:');
            this.warnings.forEach(warning => log.warn(`   - ${warning}`));
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            log.info('\n✅ Configuration is valid');
        }
    }
}