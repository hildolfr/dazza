const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { EventEmitter } = require('events');

class ConfigManager extends EventEmitter {
    constructor() {
        super();
        this.configPath = path.join(process.cwd(), 'config');
        this.defaultConfigPath = path.join(this.configPath, 'default.yaml');
        this.userConfigPath = path.join(this.configPath, 'config.yaml');
        this.moduleConfigPath = path.join(this.configPath, 'modules');
        
        this.config = {};
        this.moduleConfigs = new Map();
        this.validators = new Map();
        this.watchers = new Map();
    }
    
    /**
     * Load all configuration files with hierarchy:
     * 1. Default config
     * 2. User config
     * 3. Module-specific configs
     * 4. Environment variables
     */
    async load() {
        try {
            // Load default configuration
            const defaultConfig = await this.loadYamlFile(this.defaultConfigPath);
            
            // Load user configuration
            let userConfig = {};
            if (await this.fileExists(this.userConfigPath)) {
                userConfig = await this.loadYamlFile(this.userConfigPath);
            }
            
            // Merge configurations
            this.config = this.deepMerge(defaultConfig, userConfig);
            
            // Load module-specific configurations
            await this.loadModuleConfigs();
            
            // Apply environment variables
            this.applyEnvironmentVariables();
            
            // Validate configuration
            await this.validate();
            
            this.emit('config:loaded', this.config);
            
            return this.config;
        } catch (error) {
            console.error('Failed to load configuration:', error);
            throw error;
        }
    }
    
    /**
     * Load module-specific configuration files
     */
    async loadModuleConfigs() {
        try {
            const moduleConfigDir = this.moduleConfigPath;
            
            if (!await this.fileExists(moduleConfigDir)) {
                return;
            }
            
            const files = await fs.readdir(moduleConfigDir);
            const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
            
            for (const file of yamlFiles) {
                const moduleName = path.basename(file, path.extname(file));
                const configPath = path.join(moduleConfigDir, file);
                const moduleConfig = await this.loadYamlFile(configPath);
                
                this.moduleConfigs.set(moduleName, moduleConfig);
                
                // Merge module config into main config under modules section
                if (!this.config.modules) {
                    this.config.modules = {};
                }
                
                this.config.modules[moduleName] = this.deepMerge(
                    this.config.modules[moduleName] || {},
                    moduleConfig
                );
            }
        } catch (error) {
            console.error('Failed to load module configs:', error);
        }
    }
    
    /**
     * Apply environment variables to configuration
     * Format: MODULE_<NAME>_<KEY> or APP_<KEY>
     */
    applyEnvironmentVariables() {
        const envVars = process.env;
        
        // Process module-specific environment variables
        Object.keys(envVars).forEach(key => {
            if (key.startsWith('MODULE_')) {
                const parts = key.split('_');
                if (parts.length >= 3) {
                    const moduleName = parts[1].toLowerCase();
                    const configKey = parts.slice(2).join('_').toLowerCase();
                    
                    if (!this.config.modules) {
                        this.config.modules = {};
                    }
                    if (!this.config.modules[moduleName]) {
                        this.config.modules[moduleName] = {};
                    }
                    
                    this.setNestedValue(
                        this.config.modules[moduleName],
                        configKey,
                        this.parseEnvValue(envVars[key])
                    );
                }
            } else if (key.startsWith('APP_')) {
                const configKey = key.substring(4).toLowerCase();
                this.setNestedValue(
                    this.config,
                    configKey,
                    this.parseEnvValue(envVars[key])
                );
            }
        });
    }
    
    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path (e.g., 'modules.economy.startingBalance')
     * @param {*} defaultValue - Default value if path not found
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    /**
     * Set configuration value at runtime
     * @param {string} path - Dot-separated path
     * @param {*} value - Value to set
     */
    set(path, value) {
        this.setNestedValue(this.config, path, value);
        this.emit('config:changed', { path, value });
    }
    
    /**
     * Get module-specific configuration
     * @param {string} moduleName - Module name
     * @param {object} defaults - Default configuration
     */
    getModuleConfig(moduleName, defaults = {}) {
        const moduleConfig = this.get(`modules.${moduleName}`, {});
        return this.deepMerge(defaults, moduleConfig);
    }
    
    /**
     * Register a configuration validator for a module
     * @param {string} moduleName - Module name
     * @param {function} validator - Validation function
     */
    registerValidator(moduleName, validator) {
        this.validators.set(moduleName, validator);
    }
    
    /**
     * Validate all configurations
     */
    async validate() {
        const errors = [];
        
        // Validate global configuration
        if (!this.config.app || !this.config.app.name) {
            errors.push('Missing required config: app.name');
        }
        
        // Run module validators
        for (const [moduleName, validator] of this.validators) {
            const moduleConfig = this.getModuleConfig(moduleName);
            try {
                const result = await validator(moduleConfig);
                if (result !== true && result) {
                    errors.push(`Module ${moduleName}: ${result}`);
                }
            } catch (error) {
                errors.push(`Module ${moduleName}: ${error.message}`);
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }
    
    /**
     * Watch configuration files for changes
     * @param {boolean} enable - Enable or disable watching
     */
    async watch(enable = true) {
        if (!enable) {
            // Stop all watchers
            for (const [file, watcher] of this.watchers) {
                watcher.close();
            }
            this.watchers.clear();
            return;
        }
        
        const chokidar = require('chokidar');
        
        // Watch main config file
        if (await this.fileExists(this.userConfigPath)) {
            const watcher = chokidar.watch(this.userConfigPath, {
                persistent: true,
                ignoreInitial: true
            });
            
            watcher.on('change', async () => {
                console.log('Configuration file changed, reloading...');
                try {
                    await this.load();
                    this.emit('config:reloaded', this.config);
                } catch (error) {
                    console.error('Failed to reload configuration:', error);
                    this.emit('config:reload:error', error);
                }
            });
            
            this.watchers.set(this.userConfigPath, watcher);
        }
        
        // Watch module config directory
        if (await this.fileExists(this.moduleConfigPath)) {
            const watcher = chokidar.watch(path.join(this.moduleConfigPath, '*.yaml'), {
                persistent: true,
                ignoreInitial: true
            });
            
            watcher.on('change', async (filePath) => {
                const moduleName = path.basename(filePath, path.extname(filePath));
                console.log(`Module configuration changed: ${moduleName}`);
                
                try {
                    const moduleConfig = await this.loadYamlFile(filePath);
                    this.moduleConfigs.set(moduleName, moduleConfig);
                    
                    if (!this.config.modules) {
                        this.config.modules = {};
                    }
                    
                    this.config.modules[moduleName] = moduleConfig;
                    
                    await this.validate();
                    
                    this.emit('config:module:changed', { moduleName, config: moduleConfig });
                } catch (error) {
                    console.error(`Failed to reload module config ${moduleName}:`, error);
                    this.emit('config:reload:error', error);
                }
            });
            
            this.watchers.set(this.moduleConfigPath, watcher);
        }
    }
    
    /**
     * Save current configuration to file
     * @param {string} filePath - Path to save to (defaults to user config)
     */
    async save(filePath = null) {
        const savePath = filePath || this.userConfigPath;
        
        try {
            // Ensure directory exists
            await fs.mkdir(path.dirname(savePath), { recursive: true });
            
            // Convert to YAML
            const yamlContent = yaml.dump(this.config, {
                indent: 2,
                lineWidth: 120,
                noRefs: true
            });
            
            // Write to file
            await fs.writeFile(savePath, yamlContent, 'utf8');
            
            this.emit('config:saved', savePath);
        } catch (error) {
            console.error('Failed to save configuration:', error);
            throw error;
        }
    }
    
    // ===== Utility Methods =====
    
    /**
     * Load a YAML file
     */
    async loadYamlFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return yaml.load(content) || {};
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }
    
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        const output = Object.assign({}, target);
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    }
    
    /**
     * Check if value is an object
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
    
    /**
     * Set nested value using dot notation
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        let current = obj;
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
    
    /**
     * Parse environment variable value
     */
    parseEnvValue(value) {
        // Try to parse as JSON
        try {
            return JSON.parse(value);
        } catch {
            // Not JSON, check for specific values
            if (value.toLowerCase() === 'true') return true;
            if (value.toLowerCase() === 'false') return false;
            if (value.match(/^\d+$/)) return parseInt(value);
            if (value.match(/^\d+\.\d+$/)) return parseFloat(value);
            return value;
        }
    }
}

// Export singleton instance
module.exports = new ConfigManager();