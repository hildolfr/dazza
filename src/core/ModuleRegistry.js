import { EventEmitter } from 'events';

class ModuleRegistry extends EventEmitter {
    constructor() {
        super();
        
        this.modules = new Map(); // moduleId -> { instance, manifest, status }
        this.dependencies = new Map(); // moduleId -> Set of required moduleIds
        this.dependents = new Map(); // moduleId -> Set of dependent moduleIds
        
        // Module states
        this.STATES = {
            REGISTERED: 'registered',
            INITIALIZING: 'initializing',
            INITIALIZED: 'initialized',
            STARTING: 'starting',
            STARTED: 'started',
            STOPPING: 'stopping',
            STOPPED: 'stopped',
            ERROR: 'error'
        };
    }
    
    // ===== Registration =====
    
    register(moduleId, instance, manifest) {
        if (this.modules.has(moduleId)) {
            throw new Error(`Module ${moduleId} is already registered`);
        }
        
        // Store module
        this.modules.set(moduleId, {
            instance,
            manifest,
            status: this.STATES.REGISTERED,
            error: null
        });
        
        // Track dependencies
        if (manifest.requires && manifest.requires.length > 0) {
            this.dependencies.set(moduleId, new Set(manifest.requires));
            
            // Update dependents
            for (const depId of manifest.requires) {
                if (!this.dependents.has(depId)) {
                    this.dependents.set(depId, new Set());
                }
                this.dependents.get(depId).add(moduleId);
            }
        }
        
        this.emit('module:registered', { moduleId, manifest });
    }
    
    unregister(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) return false;
        
        // Check if other modules depend on this one
        const dependents = this.dependents.get(moduleId);
        if (dependents && dependents.size > 0) {
            throw new Error(`Cannot unregister ${moduleId}: required by ${Array.from(dependents).join(', ')}`);
        }
        
        // Remove from dependencies
        const deps = this.dependencies.get(moduleId);
        if (deps) {
            for (const depId of deps) {
                const depDependents = this.dependents.get(depId);
                if (depDependents) {
                    depDependents.delete(moduleId);
                }
            }
        }
        
        // Remove module
        this.modules.delete(moduleId);
        this.dependencies.delete(moduleId);
        this.dependents.delete(moduleId);
        
        this.emit('module:unregistered', { moduleId });
        return true;
    }
    
    // ===== Dependency Resolution =====
    
    resolveDependencies() {
        const resolved = [];
        const seen = new Set();
        
        const visit = (moduleId) => {
            if (seen.has(moduleId)) return;
            seen.add(moduleId);
            
            const deps = this.dependencies.get(moduleId);
            if (deps) {
                for (const depId of deps) {
                    if (!this.modules.has(depId)) {
                        throw new Error(`Module ${moduleId} requires ${depId}, which is not registered`);
                    }
                    visit(depId);
                }
            }
            
            resolved.push(moduleId);
        };
        
        // Visit all modules
        for (const moduleId of this.modules.keys()) {
            visit(moduleId);
        }
        
        return resolved;
    }
    
    // ===== Lifecycle Management =====
    
    async initializeModules() {
        const order = this.resolveDependencies();
        
        for (const moduleId of order) {
            await this.initializeModule(moduleId);
        }
    }
    
    async initializeModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        
        if (module.status !== this.STATES.REGISTERED) {
            return; // Already initialized
        }
        
        this.updateStatus(moduleId, this.STATES.INITIALIZING);
        
        try {
            await module.instance.init();
            this.updateStatus(moduleId, this.STATES.INITIALIZED);
            this.emit('module:initialized', { moduleId });
        } catch (error) {
            this.updateStatus(moduleId, this.STATES.ERROR, error);
            this.emit('module:error', { moduleId, error: error.message });
            throw error;
        }
    }
    
    async startModules() {
        const order = this.resolveDependencies();
        
        for (const moduleId of order) {
            await this.startModule(moduleId);
        }
    }
    
    async startModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        
        if (module.status !== this.STATES.INITIALIZED) {
            return; // Not ready to start
        }
        
        this.updateStatus(moduleId, this.STATES.STARTING);
        
        try {
            await module.instance.start();
            this.updateStatus(moduleId, this.STATES.STARTED);
            this.emit('module:started', { moduleId });
        } catch (error) {
            this.updateStatus(moduleId, this.STATES.ERROR, error);
            this.emit('module:error', { moduleId, error: error.message });
            throw error;
        }
    }
    
    async stopModules() {
        // Stop in reverse order
        const order = this.resolveDependencies().reverse();
        
        for (const moduleId of order) {
            await this.stopModule(moduleId);
        }
    }
    
    async stopModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        
        if (module.status !== this.STATES.STARTED) {
            return; // Not running
        }
        
        this.updateStatus(moduleId, this.STATES.STOPPING);
        
        try {
            await module.instance.stop();
            this.updateStatus(moduleId, this.STATES.STOPPED);
            this.emit('module:stopped', { moduleId });
        } catch (error) {
            this.updateStatus(moduleId, this.STATES.ERROR, error);
            this.emit('module:error', { moduleId, error: error.message });
            throw error;
        }
    }
    
    // ===== Status Management =====
    
    updateStatus(moduleId, status, error = null) {
        const module = this.modules.get(moduleId);
        if (!module) return;
        
        module.status = status;
        module.error = error;
        
        this.emit('module:status-changed', { 
            moduleId, 
            status,
            error: error?.message 
        });
    }
    
    getStatus(moduleId) {
        const module = this.modules.get(moduleId);
        return module ? module.status : null;
    }
    
    // ===== Module Access =====
    
    get(moduleId) {
        return this.modules.get(moduleId);
    }
    
    getInstance(moduleId) {
        return this.modules.get(moduleId)?.instance;
    }
    
    getAll() {
        return Array.from(this.modules.entries()).map(([id, module]) => ({
            id,
            manifest: module.manifest,
            status: module.status,
            error: module.error?.message
        }));
    }
    
    has(moduleId) {
        return this.modules.has(moduleId);
    }
    
    // ===== Dependency Queries =====
    
    getDependencies(moduleId) {
        return Array.from(this.dependencies.get(moduleId) || []);
    }
    
    getDependents(moduleId) {
        return Array.from(this.dependents.get(moduleId) || []);
    }
    
    canUnload(moduleId) {
        const dependents = this.dependents.get(moduleId);
        return !dependents || dependents.size === 0;
    }
    
    // ===== Module Discovery =====
    
    findModulesByCapability(capability) {
        const modules = [];
        
        for (const [id, module] of this.modules.entries()) {
            const provides = module.manifest.provides || [];
            if (provides.includes(capability)) {
                modules.push(id);
            }
        }
        
        return modules;
    }
    
    getModulesByStatus(status) {
        const modules = [];
        
        for (const [id, module] of this.modules.entries()) {
            if (module.status === status) {
                modules.push(id);
            }
        }
        
        return modules;
    }
}

export default ModuleRegistry;