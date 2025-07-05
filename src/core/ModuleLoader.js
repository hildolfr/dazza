const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class ModuleLoader extends EventEmitter {
    constructor(context) {
        super();
        this.context = context;
        this.modulesPath = path.join(__dirname, '..', 'modules');
        this.loadedModules = new Map();
        this.failedModules = new Map();
    }
    
    async discoverModules() {
        this.emit('discovery:start');
        const discovered = [];
        
        try {
            const entries = await fs.readdir(this.modulesPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('_')) {
                    const modulePath = path.join(this.modulesPath, entry.name);
                    
                    try {
                        const moduleInfo = await this.loadModuleInfo(modulePath);
                        if (moduleInfo) {
                            discovered.push(moduleInfo);
                            this.emit('module:discovered', moduleInfo);
                        }
                    } catch (error) {
                        this.failedModules.set(entry.name, error);
                        this.emit('module:discovery-failed', { 
                            name: entry.name, 
                            error: error.message 
                        });
                    }
                }
            }
            
            this.emit('discovery:complete', { count: discovered.length });
            return discovered;
        } catch (error) {
            this.emit('discovery:error', error);
            throw error;
        }
    }
    
    async loadModuleInfo(modulePath) {
        const manifestPath = path.join(modulePath, 'module.json');
        const indexPath = path.join(modulePath, 'index.js');
        
        // Check if required files exist
        const [manifestExists, indexExists] = await Promise.all([
            this.fileExists(manifestPath),
            this.fileExists(indexPath)
        ]);
        
        if (!manifestExists || !indexExists) {
            return null;
        }
        
        // Load and validate manifest
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        // Validate manifest
        this.validateManifest(manifest);
        
        return {
            path: modulePath,
            manifestPath,
            indexPath,
            manifest,
            name: manifest.name,
            enabled: this.isModuleEnabled(manifest)
        };
    }
    
    validateManifest(manifest) {
        const required = ['name', 'version', 'description'];
        
        for (const field of required) {
            if (!manifest[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate rooms array if present
        if (manifest.rooms && !Array.isArray(manifest.rooms)) {
            throw new Error('rooms must be an array');
        }
        
        // Validate requires array if present
        if (manifest.requires && !Array.isArray(manifest.requires)) {
            throw new Error('requires must be an array');
        }
        
        // Validate subscribes/emits if present
        if (manifest.subscribes && !Array.isArray(manifest.subscribes)) {
            throw new Error('subscribes must be an array');
        }
        
        if (manifest.emits && !Array.isArray(manifest.emits)) {
            throw new Error('emits must be an array');
        }
    }
    
    isModuleEnabled(manifest) {
        // Check if explicitly disabled in manifest
        if (manifest.enabled === false) {
            return false;
        }
        
        // Check global config override
        const globalConfig = this.context.config.modules?.[manifest.name];
        if (globalConfig?.enabled === false) {
            return false;
        }
        
        // Check environment variable override
        const envKey = `MODULE_${manifest.name.toUpperCase()}_ENABLED`;
        if (process.env[envKey] === 'false') {
            return false;
        }
        
        return true;
    }
    
    async loadModule(moduleInfo) {
        if (!moduleInfo.enabled) {
            this.emit('module:skipped', { 
                name: moduleInfo.name, 
                reason: 'disabled' 
            });
            return null;
        }
        
        this.emit('module:loading', { name: moduleInfo.name });
        
        try {
            // Clear require cache for hot reloading
            delete require.cache[require.resolve(moduleInfo.indexPath)];
            
            // Load module class
            const ModuleClass = require(moduleInfo.indexPath);
            
            // Create module context
            const moduleContext = this.createModuleContext(moduleInfo);
            
            // Instantiate module
            const instance = new ModuleClass(moduleContext);
            
            // Store loaded module
            this.loadedModules.set(moduleInfo.name, {
                info: moduleInfo,
                instance,
                class: ModuleClass
            });
            
            this.emit('module:loaded', { 
                name: moduleInfo.name,
                version: moduleInfo.manifest.version 
            });
            
            return instance;
        } catch (error) {
            this.failedModules.set(moduleInfo.name, error);
            this.emit('module:load-failed', { 
                name: moduleInfo.name, 
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    createModuleContext(moduleInfo) {
        // Get module-specific configuration
        const moduleConfig = {
            ...moduleInfo.manifest.config,
            ...this.context.config.modules?.[moduleInfo.name]
        };
        
        // Create dynamic context with getter for database service
        const context = {
            manifest: moduleInfo.manifest,
            userConfig: moduleConfig,
            config: this.context.config, // Add global config access
            eventBus: this.context.eventBus,
            logger: this.context.logger,
            scheduler: this.context.scheduler,
            performanceMonitor: this.context.performanceMonitor,
            modules: this.context.moduleRegistry,
            roomConnections: this.context.roomConnections,
            services: this.context.services,
            api: this.context.api
        };
        
        // Debug: Check if services are available
        this.context.logger.info(`Creating context for ${moduleInfo.name}`, {
            hasServices: !!this.context.services,
            servicesSize: this.context.services?.size || 0
        });
        
        // Add dynamic getter for database service
        Object.defineProperty(context, 'db', {
            get: () => this.context.services?.get('database'),
            enumerable: true,
            configurable: true
        });
        
        return context;
    }
    
    async reloadModule(moduleName) {
        const loaded = this.loadedModules.get(moduleName);
        if (!loaded) {
            throw new Error(`Module ${moduleName} is not loaded`);
        }
        
        this.emit('module:reloading', { name: moduleName });
        
        try {
            // Stop the existing module
            await loaded.instance.stop();
            await loaded.instance.destroy();
            
            // Reload module info
            const moduleInfo = await this.loadModuleInfo(loaded.info.path);
            
            // Load new instance
            const newInstance = await this.loadModule(moduleInfo);
            
            if (newInstance) {
                // Initialize and start new instance
                await newInstance.init();
                await newInstance.start();
                
                this.emit('module:reloaded', { name: moduleName });
                return newInstance;
            }
        } catch (error) {
            this.emit('module:reload-failed', { 
                name: moduleName, 
                error: error.message 
            });
            throw error;
        }
    }
    
    getLoadedModules() {
        return Array.from(this.loadedModules.entries()).map(([name, data]) => ({
            name,
            version: data.info.manifest.version,
            enabled: true,
            instance: data.instance
        }));
    }
    
    getFailedModules() {
        return Array.from(this.failedModules.entries()).map(([name, error]) => ({
            name,
            error: error.message,
            stack: error.stack
        }));
    }
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = ModuleLoader;