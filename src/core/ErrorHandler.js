import { EventEmitter } from 'events';

class ErrorHandler extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxRetries: 5,
            retryDelay: 1000,
            maxRetryDelay: 30000,
            shutdownTimeout: 30000,
            ...config
        };
        
        this.moduleRegistry = null;
        this.eventBus = null;
        this.logger = null;
        
        // Error tracking
        this.errorCounts = new Map(); // moduleId -> error count
        this.restartAttempts = new Map(); // moduleId -> restart attempts
        this.globalErrors = [];
        this.maxGlobalErrors = 100;
        
        // Death spiral prevention
        this.moduleRestartHistory = new Map(); // moduleId -> array of restart timestamps
        this.maxRestartsPerHour = config.maxRestartsPerHour || 3;
        this.maxRestartsPerDay = config.maxRestartsPerDay || 10;
        this.disabledModules = new Set(); // Modules disabled due to excessive failures
        this.moduleRecoveryQueue = new Map(); // moduleId -> recovery timeout
        this.emergencyMode = false;
        
        // Shutdown state
        this.isShuttingDown = false;
        this.shutdownPromise = null;
        
        // Install global handlers
        this.installGlobalHandlers();
    }
    
    // ===== Initialization =====
    
    initialize(moduleRegistry, eventBus, logger) {
        this.moduleRegistry = moduleRegistry;
        this.eventBus = eventBus;
        this.logger = logger || console;
        
        // Subscribe to module errors
        if (this.eventBus) {
            this.eventBus.subscribe('error-handler', 'module:error', (data) => {
                this.handleModuleError(data.moduleId, data.error);
            });
        }
    }
    
    // ===== Global Error Handlers =====
    
    installGlobalHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.handleGlobalError('uncaughtException', error);
            
            // Give modules time to clean up before exiting
            setTimeout(() => {
                process.exit(1);
            }, 5000);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            error.promise = promise;
            this.handleGlobalError('unhandledRejection', error);
        });
        
        // Handle warnings
        process.on('warning', (warning) => {
            this.logger.warn('Process warning:', warning);
        });
        
        // Graceful shutdown handlers
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    }
    
    // ===== Module Error Handling =====
    
    async handleModuleError(moduleId, error) {
        if (this.isShuttingDown || this.emergencyMode) return;
        
        // Check if module is already disabled
        if (this.disabledModules.has(moduleId)) {
            this.logger.warn(`Ignoring error from disabled module: ${moduleId}`);
            return;
        }
        
        // Ensure error is an Error object
        if (!(error instanceof Error)) {
            error = new Error(String(error));
        }
        
        // Track error count
        const count = (this.errorCounts.get(moduleId) || 0) + 1;
        this.errorCounts.set(moduleId, count);
        
        // Check for death spiral conditions
        if (this._checkDeathSpiral(moduleId, count)) {
            this.logger.error(`Death spiral detected for module ${moduleId}, entering emergency mode`);
            this.emergencyMode = true;
            await this._handleDeathSpiral(moduleId);
            return;
        }
        
        // Log error with context
        this.logger.error(`Module ${moduleId} error (${count}):`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            moduleId,
            emergencyMode: this.emergencyMode
        });
        
        // Emit error event (if not in emergency mode)
        if (!this.emergencyMode) {
            try {
                this.emit('module:error', {
                    moduleId,
                    error,
                    count,
                    timestamp: Date.now()
                });
            } catch (emitError) {
                this.logger.error('Failed to emit module error event:', emitError);
                this.emergencyMode = true;
            }
        }
        
        // Determine action based on error type and count
        if (this.isRecoverable(error) && count < this.config.maxRetries && !this._isRestartLimited(moduleId)) {
            await this.recoverModule(moduleId);
        } else if (count >= this.config.maxRetries || this._isRestartLimited(moduleId)) {
            await this.disableModule(moduleId);
        }
    }
    
    _checkDeathSpiral(moduleId, errorCount) {
        // Check if we have too many errors in a short time
        if (errorCount > 10) {
            return true;
        }
        
        // Check restart frequency
        const restartHistory = this.moduleRestartHistory.get(moduleId) || [];
        const now = Date.now();
        const recentRestarts = restartHistory.filter(timestamp => now - timestamp < 300000); // 5 minutes
        
        if (recentRestarts.length > 5) {
            return true;
        }
        
        return false;
    }
    
    async _handleDeathSpiral(moduleId) {
        // Disable the problematic module
        await this.disableModule(moduleId);
        
        // Schedule emergency mode reset
        setTimeout(() => {
            this.emergencyMode = false;
            this.logger.info('Emergency mode cleared');
        }, 300000); // 5 minutes
        
        // Emit emergency event
        this.emit('emergency:death-spiral', {
            moduleId,
            timestamp: Date.now()
        });
    }
    
    _isRestartLimited(moduleId) {
        const restartHistory = this.moduleRestartHistory.get(moduleId) || [];
        const now = Date.now();
        
        // Check hourly limit
        const hourlyRestarts = restartHistory.filter(timestamp => now - timestamp < 3600000);
        if (hourlyRestarts.length >= this.maxRestartsPerHour) {
            return true;
        }
        
        // Check daily limit
        const dailyRestarts = restartHistory.filter(timestamp => now - timestamp < 86400000);
        if (dailyRestarts.length >= this.maxRestartsPerDay) {
            return true;
        }
        
        return false;
    }
    
    async recoverModule(moduleId) {
        if (this.isShuttingDown || this.emergencyMode || this.disabledModules.has(moduleId)) return;
        
        // Check if already in recovery queue
        if (this.moduleRecoveryQueue.has(moduleId)) {
            this.logger.warn(`Module ${moduleId} already in recovery queue`);
            return;
        }
        
        // Check restart limits before attempting recovery
        if (this._isRestartLimited(moduleId)) {
            this.logger.error(`Module ${moduleId} restart limited, disabling module`);
            await this.disableModule(moduleId);
            return;
        }
        
        const attempts = (this.restartAttempts.get(moduleId) || 0) + 1;
        this.restartAttempts.set(moduleId, attempts);
        
        // Track restart in history
        const restartHistory = this.moduleRestartHistory.get(moduleId) || [];
        restartHistory.push(Date.now());
        this.moduleRestartHistory.set(moduleId, restartHistory);
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.config.retryDelay * Math.pow(2, attempts - 1),
            this.config.maxRetryDelay
        );
        
        this.logger.info(`Attempting to recover module ${moduleId} in ${delay}ms (attempt ${attempts})`);
        
        // Add to recovery queue
        const recoveryTimeout = setTimeout(async () => {
            this.moduleRecoveryQueue.delete(moduleId);
            
            if (this.isShuttingDown || this.emergencyMode || this.disabledModules.has(moduleId)) return;
            
            try {
                // Stop module if running
                const status = this.moduleRegistry.getStatus(moduleId);
                if (status === 'started') {
                    await this.moduleRegistry.stopModule(moduleId);
                }
                
                // Re-initialize and start module
                await this.moduleRegistry.initializeModule(moduleId);
                await this.moduleRegistry.startModule(moduleId);
                
                // Reset error tracking on success
                this.errorCounts.delete(moduleId);
                this.restartAttempts.delete(moduleId);
                
                this.logger.info(`Successfully recovered module ${moduleId}`);
                
                this.emit('module:recovered', {
                    moduleId,
                    attempts,
                    timestamp: Date.now()
                });
                
            } catch (error) {
                this.logger.error(`Failed to recover module ${moduleId}:`, error);
                // Recovery failed, handle as new error (with recursion protection)
                if (!this.emergencyMode && !this.disabledModules.has(moduleId)) {
                    await this.handleModuleError(moduleId, error);
                }
            }
        }, delay);
        
        this.moduleRecoveryQueue.set(moduleId, recoveryTimeout);
    }
    
    async disableModule(moduleId) {
        if (this.isShuttingDown) return;
        
        try {
            // Add to disabled modules set
            this.disabledModules.add(moduleId);
            
            // Cancel any pending recovery
            if (this.moduleRecoveryQueue.has(moduleId)) {
                clearTimeout(this.moduleRecoveryQueue.get(moduleId));
                this.moduleRecoveryQueue.delete(moduleId);
            }
            
            const status = this.moduleRegistry.getStatus(moduleId);
            
            if (status === 'started') {
                await this.moduleRegistry.stopModule(moduleId);
            }
            
            this.logger.error(`Module ${moduleId} disabled due to repeated errors`);
            
            this.emit('module:disabled', {
                moduleId,
                reason: 'too_many_errors',
                errorCount: this.errorCounts.get(moduleId),
                restartAttempts: this.restartAttempts.get(moduleId),
                timestamp: Date.now()
            });
            
            // Clean up tracking
            this.errorCounts.delete(moduleId);
            this.restartAttempts.delete(moduleId);
            
            // Schedule re-enablement attempt after a cooldown period
            setTimeout(() => {
                this._scheduleModuleReenablement(moduleId);
            }, 3600000); // 1 hour cooldown
            
        } catch (error) {
            this.logger.error(`Failed to disable module ${moduleId}:`, error);
        }
    }
    
    _scheduleModuleReenablement(moduleId) {
        if (this.isShuttingDown || !this.disabledModules.has(moduleId)) return;
        
        this.logger.info(`Attempting to re-enable module ${moduleId} after cooldown`);
        
        // Remove from disabled set
        this.disabledModules.delete(moduleId);
        
        // Clean up restart history (give it a fresh start)
        this.moduleRestartHistory.delete(moduleId);
        
        this.emit('module:reenabled', {
            moduleId,
            timestamp: Date.now()
        });
    }
    
    // ===== Global Error Handling =====
    
    handleGlobalError(type, error) {
        const errorInfo = {
            type,
            message: error.message,
            stack: error.stack,
            code: error.code,
            timestamp: Date.now()
        };
        
        // Log the error
        this.logger.error(`Global ${type}:`, errorInfo);
        
        // Store in history
        this.globalErrors.push(errorInfo);
        if (this.globalErrors.length > this.maxGlobalErrors) {
            this.globalErrors.shift();
        }
        
        // Emit event
        this.emit('global:error', errorInfo);
        
        // Check if error is from a specific module
        const moduleMatch = error.stack?.match(/modules\/([^\/]+)/);
        if (moduleMatch && this.moduleRegistry) {
            const moduleName = moduleMatch[1];
            this.handleModuleError(moduleName, error);
        }
    }
    
    // ===== Graceful Shutdown =====
    
    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            return this.shutdownPromise;
        }
        
        this.isShuttingDown = true;
        this.logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        this.shutdownPromise = this._performShutdown();
        
        // Force exit after timeout
        const forceExitTimer = setTimeout(() => {
            this.logger.error('Graceful shutdown timeout, forcing exit');
            process.exit(1);
        }, this.config.shutdownTimeout);
        
        try {
            await this.shutdownPromise;
            clearTimeout(forceExitTimer);
            this.logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            clearTimeout(forceExitTimer);
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
    
    async _performShutdown() {
        const shutdownSteps = [];
        
        // Stop all modules
        if (this.moduleRegistry) {
            shutdownSteps.push(
                this.moduleRegistry.stopModules()
                    .catch(err => this.logger.error('Error stopping modules:', err))
            );
        }
        
        // Emit shutdown event
        this.emit('shutdown');
        
        // Wait for all shutdown steps
        await Promise.all(shutdownSteps);
        
        // Clean up error handler state
        this._cleanup();
    }
    
    _cleanup() {
        // Clear all recovery timeouts
        this.moduleRecoveryQueue.forEach((timeout, moduleId) => {
            clearTimeout(timeout);
            this.logger.debug(`Cleared recovery timeout for module: ${moduleId}`);
        });
        this.moduleRecoveryQueue.clear();
        
        // Clear tracking maps
        this.errorCounts.clear();
        this.restartAttempts.clear();
        this.moduleRestartHistory.clear();
        this.disabledModules.clear();
        this.globalErrors.length = 0;
        
        this.emergencyMode = false;
        
        this.logger.info('ErrorHandler cleanup complete');
    }
    
    // ===== Error Analysis =====
    
    isRecoverable(error) {
        const recoverableTypes = [
            'SQLITE_BUSY',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNRESET',
            'EPIPE'
        ];
        
        const recoverableMessages = [
            'socket hang up',
            'connect timeout',
            'request timeout'
        ];
        
        // Check error codes
        if (recoverableTypes.includes(error.code)) {
            return true;
        }
        
        // Check error messages
        const errorMessage = error.message?.toLowerCase() || '';
        return recoverableMessages.some(msg => 
            errorMessage.includes(msg.toLowerCase())
        );
    }
    
    // ===== Status & Reporting =====
    
    getStatus() {
        return {
            isShuttingDown: this.isShuttingDown,
            emergencyMode: this.emergencyMode,
            moduleErrors: Object.fromEntries(this.errorCounts),
            restartAttempts: Object.fromEntries(this.restartAttempts),
            disabledModules: Array.from(this.disabledModules),
            pendingRecovery: Array.from(this.moduleRecoveryQueue.keys()),
            globalErrors: this.globalErrors.slice(-10), // Last 10 global errors
            uptime: process.uptime(),
            restartHistory: Object.fromEntries(
                Array.from(this.moduleRestartHistory.entries()).map(([moduleId, history]) => [
                    moduleId,
                    {
                        total: history.length,
                        lastHour: history.filter(ts => Date.now() - ts < 3600000).length,
                        lastDay: history.filter(ts => Date.now() - ts < 86400000).length
                    }
                ])
            )
        };
    }
    
    getModuleErrorInfo(moduleId) {
        return {
            errorCount: this.errorCounts.get(moduleId) || 0,
            restartAttempts: this.restartAttempts.get(moduleId) || 0
        };
    }
    
    clearModuleErrors(moduleId) {
        this.errorCounts.delete(moduleId);
        this.restartAttempts.delete(moduleId);
    }
    
    // ===== Health Checks =====
    
    async checkHealth() {
        const health = {
            status: 'healthy',
            modules: {},
            system: {
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
        
        // Check each module
        if (this.moduleRegistry) {
            const modules = this.moduleRegistry.getAll();
            
            for (const module of modules) {
                const errorInfo = this.getModuleErrorInfo(module.id);
                
                health.modules[module.id] = {
                    status: module.status,
                    errors: errorInfo.errorCount,
                    restarts: errorInfo.restartAttempts
                };
                
                // Mark unhealthy if too many errors
                if (errorInfo.errorCount >= this.config.maxRetries) {
                    health.status = 'unhealthy';
                }
            }
        }
        
        return health;
    }
}

export default ErrorHandler;