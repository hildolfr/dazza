import { EventEmitter } from 'events';
import HealthChecker from './HealthChecker.js';
import HealthReporter from './HealthReporter.js';

/**
 * Central Health Monitor - Comprehensive system health monitoring orchestrator
 * 
 * Provides:
 * 1. Unified health dashboard for all system components
 * 2. Health check orchestration across all modules and services
 * 3. Early warning system with proactive alerting
 * 4. Health metrics aggregation from all protection systems
 * 5. Predictive issue detection using trends and patterns
 * 6. Circuit breaker integration for failing components
 */
export class HealthMonitor extends EventEmitter {
    constructor(services, config, logger) {
        super();
        this.services = services;
        this.config = config;
        this.logger = logger;
        
        // Health monitoring configuration
        this.healthConfig = {
            // Monitoring intervals
            checkInterval: this.config.health?.checkInterval ?? 30000, // 30 seconds
            reportInterval: this.config.health?.reportInterval ?? 300000, // 5 minutes
            aggregationInterval: this.config.health?.aggregationInterval ?? 60000, // 1 minute
            
            // Health thresholds
            thresholds: {
                // Overall system health levels
                healthy: 0.95,      // 95% components healthy
                warning: 0.85,      // 85% components healthy
                degraded: 0.70,     // 70% components healthy
                critical: 0.50,     // 50% components healthy
                failed: 0.25,       // 25% components healthy
                
                // Component response times
                responseTime: {
                    good: 100,      // 100ms
                    warning: 500,   // 500ms
                    critical: 2000  // 2s
                },
                
                // Error rates
                errorRate: {
                    warning: 0.01,  // 1%
                    critical: 0.05  // 5%
                },
                
                // Resource utilization
                memory: {
                    warning: 0.80,  // 80%
                    critical: 0.90  // 90%
                },
                cpu: {
                    warning: 0.80,  // 80%
                    critical: 0.90  // 90%
                },
                
                ...this.config.health?.thresholds
            },
            
            // Alerting settings
            alerts: {
                enabled: this.config.health?.alerts?.enabled ?? true,
                channels: this.config.health?.alerts?.channels ?? ['log', 'event'],
                cooldown: this.config.health?.alerts?.cooldown ?? 300000, // 5 minutes
                escalation: this.config.health?.alerts?.escalation ?? true,
                ...this.config.health?.alerts
            },
            
            // Data retention
            retention: {
                healthHistory: this.config.health?.retention?.healthHistory ?? 1440, // 24 hours
                metricHistory: this.config.health?.retention?.metricHistory ?? 4320, // 3 days
                alertHistory: this.config.health?.retention?.alertHistory ?? 10080, // 7 days
                ...this.config.health?.retention
            },
            
            // Predictive analysis
            prediction: {
                enabled: this.config.health?.prediction?.enabled ?? true,
                lookbackWindow: this.config.health?.prediction?.lookbackWindow ?? 3600000, // 1 hour
                trendThreshold: this.config.health?.prediction?.trendThreshold ?? 0.1, // 10% change
                ...this.config.health?.prediction
            }
        };
        
        // Core components
        this.healthChecker = null;
        this.healthReporter = null;
        
        // Health state management
        this.isInitialized = false;
        this.isMonitoring = false;
        this.currentHealthLevel = 'healthy';
        this.lastHealthCheck = null;
        this.lastReport = null;
        
        // Component registry and status tracking
        this.components = new Map(); // componentId -> component info
        this.healthStates = new Map(); // componentId -> health state
        this.protectionSystems = new Map(); // systemId -> protection system
        this.circuitBreakers = new Map(); // componentId -> circuit breaker state
        
        // Health metrics aggregation
        this.healthMetrics = {
            system: {
                overall: { status: 'unknown', score: 0, timestamp: Date.now() },
                components: new Map(),
                protection: new Map(),
                performance: new Map()
            },
            history: [],
            trends: new Map(),
            predictions: new Map()
        };
        
        // Alert management
        this.alertState = {
            active: new Map(), // alertId -> alert info
            history: [],
            suppressions: new Map(), // componentId -> suppression info
            escalations: new Map() // alertId -> escalation info
        };
        
        // Monitoring intervals
        this.intervals = {
            healthCheck: null,
            reporting: null,
            aggregation: null,
            prediction: null
        };
        
        // Statistics
        this.stats = {
            startTime: Date.now(),
            totalHealthChecks: 0,
            totalAlerts: 0,
            systemStateChanges: 0,
            predictionAccuracy: {
                correct: 0,
                total: 0
            },
            componentFailures: 0,
            recoveries: 0
        };
        
        // Emergency state management
        this.emergencyState = {
            isActive: false,
            triggeredBy: null,
            startTime: null,
            actions: [],
            recoveryPlan: null
        };
    }
    
    /**
     * Initialize the health monitoring system
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            this.logger.info('Initializing Health Monitoring System');
            
            // Initialize health checker
            this.healthChecker = new HealthChecker(
                this.services,
                this.healthConfig,
                this.logger
            );
            
            // Initialize health reporter
            this.healthReporter = new HealthReporter(
                this.healthConfig,
                this.logger
            );
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Register built-in protection systems
            await this.registerProtectionSystems();
            
            // Start monitoring
            await this.startMonitoring();
            
            this.isInitialized = true;
            this.logger.info('Health Monitoring System initialized successfully', {
                components: this.components.size,
                protectionSystems: this.protectionSystems.size,
                checkInterval: this.healthConfig.checkInterval
            });
            
            this.emit('health:system:initialized', {
                timestamp: Date.now(),
                config: this.healthConfig
            });
            
        } catch (error) {
            this.logger.error('Failed to initialize Health Monitoring System', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Setup event handlers for health monitoring components
     */
    setupEventHandlers() {
        // Health checker events
        this.healthChecker.on('component:health:changed', this.handleComponentHealthChange.bind(this));
        this.healthChecker.on('component:health:critical', this.handleComponentCritical.bind(this));
        this.healthChecker.on('component:health:recovered', this.handleComponentRecovery.bind(this));
        this.healthChecker.on('circuit:breaker:opened', this.handleCircuitBreakerOpened.bind(this));
        this.healthChecker.on('circuit:breaker:closed', this.handleCircuitBreakerClosed.bind(this));
        
        // Health reporter events
        this.healthReporter.on('alert:triggered', this.handleAlertTriggered.bind(this));
        this.healthReporter.on('alert:resolved', this.handleAlertResolved.bind(this));
        this.healthReporter.on('trend:detected', this.handleTrendDetected.bind(this));
        this.healthReporter.on('prediction:generated', this.handlePredictionGenerated.bind(this));
        
        // System-wide health events
        this.on('health:system:changed', this.handleSystemHealthChange.bind(this));
        this.on('health:emergency:activated', this.handleEmergencyActivated.bind(this));
        this.on('health:emergency:resolved', this.handleEmergencyResolved.bind(this));
    }
    
    /**
     * Register built-in protection systems for health monitoring
     */
    async registerProtectionSystems() {
        try {
            // Register Memory Manager
            if (this.services.has('memory-manager') || this.services.has('memoryManager')) {
                const memoryManager = this.services.get('memory-manager') || this.services.get('memoryManager');
                await this.registerProtectionSystem('memory-management', memoryManager, {
                    type: 'memory',
                    priority: 'critical',
                    healthCheck: () => this.checkMemoryManagerHealth(memoryManager),
                    metrics: () => memoryManager.getMemoryStats()
                });
            }
            
            // Register Stack Monitor
            if (this.services.has('stack-monitor') || this.services.has('stackMonitor')) {
                const stackMonitor = this.services.get('stack-monitor') || this.services.get('stackMonitor');
                await this.registerProtectionSystem('stack-monitoring', stackMonitor, {
                    type: 'performance',
                    priority: 'critical',
                    healthCheck: () => this.checkStackMonitorHealth(stackMonitor),
                    metrics: () => stackMonitor.getStatistics()
                });
            }
            
            // Register Event Bus
            if (this.services.has('event-bus') || this.services.has('eventBus')) {
                const eventBus = this.services.get('event-bus') || this.services.get('eventBus');
                await this.registerProtectionSystem('event-bus', eventBus, {
                    type: 'communication',
                    priority: 'critical',
                    healthCheck: () => this.checkEventBusHealth(eventBus),
                    metrics: () => eventBus.getStats()
                });
            }
            
            // Register Error Handler
            if (this.services.has('error-handler') || this.services.has('errorHandler')) {
                const errorHandler = this.services.get('error-handler') || this.services.get('errorHandler');
                await this.registerProtectionSystem('error-handling', errorHandler, {
                    type: 'reliability',
                    priority: 'high',
                    healthCheck: () => this.checkErrorHandlerHealth(errorHandler),
                    metrics: () => errorHandler.getStatus()
                });
            }
            
            // Register Performance Monitor
            if (this.services.has('performance-monitor') || this.services.has('performanceMonitor')) {
                const performanceMonitor = this.services.get('performance-monitor') || this.services.get('performanceMonitor');
                await this.registerProtectionSystem('performance-monitoring', performanceMonitor, {
                    type: 'performance',
                    priority: 'medium',
                    healthCheck: () => this.checkPerformanceMonitorHealth(performanceMonitor),
                    metrics: () => performanceMonitor.getSummary()
                });
            }
            
            // Register Database connections
            if (this.services.has('database') || this.services.has('db')) {
                const database = this.services.get('database') || this.services.get('db');
                await this.registerProtectionSystem('database', database, {
                    type: 'data',
                    priority: 'critical',
                    healthCheck: () => this.checkDatabaseHealth(database),
                    metrics: () => this.getDatabaseMetrics(database)
                });
            }
            
            // Register Module Registry
            if (this.services.has('module-registry') || this.services.has('moduleRegistry')) {
                const moduleRegistry = this.services.get('module-registry') || this.services.get('moduleRegistry');
                await this.registerProtectionSystem('module-system', moduleRegistry, {
                    type: 'system',
                    priority: 'high',
                    healthCheck: () => this.checkModuleRegistryHealth(moduleRegistry),
                    metrics: () => this.getModuleRegistryMetrics(moduleRegistry)
                });
            }
            
            this.logger.info(`Registered ${this.protectionSystems.size} protection systems for health monitoring`);
            
        } catch (error) {
            this.logger.error('Error registering protection systems', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Register a protection system for health monitoring
     */
    async registerProtectionSystem(systemId, system, config) {
        this.protectionSystems.set(systemId, {
            system,
            config,
            lastCheck: null,
            status: 'unknown',
            metrics: null,
            circuitBreaker: {
                isOpen: false,
                failureCount: 0,
                lastFailure: null
            }
        });
        
        this.logger.debug(`Registered protection system: ${systemId}`, {
            type: config.type,
            priority: config.priority
        });
    }
    
    /**
     * Register a component for health monitoring
     */
    async registerComponent(componentId, component, config = {}) {
        this.components.set(componentId, {
            component,
            config: {
                type: config.type || 'service',
                priority: config.priority || 'medium',
                healthCheck: config.healthCheck || null,
                metrics: config.metrics || null,
                dependencies: config.dependencies || [],
                tags: config.tags || [],
                ...config
            },
            lastCheck: null,
            status: 'unknown',
            metrics: null
        });
        
        // Initialize health state
        this.healthStates.set(componentId, {
            status: 'unknown',
            score: 0,
            lastUpdate: Date.now(),
            history: []
        });
        
        this.logger.debug(`Registered component for health monitoring: ${componentId}`, {
            type: config.type,
            priority: config.priority
        });
    }
    
    /**
     * Start health monitoring
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        try {
            // Start health checking interval
            this.intervals.healthCheck = setInterval(() => {
                this.performHealthCheck();
            }, this.healthConfig.checkInterval);
            
            // Start reporting interval
            this.intervals.reporting = setInterval(() => {
                this.generateHealthReport();
            }, this.healthConfig.reportInterval);
            
            // Start metrics aggregation interval
            this.intervals.aggregation = setInterval(() => {
                this.aggregateMetrics();
            }, this.healthConfig.aggregationInterval);
            
            // Start prediction analysis if enabled
            if (this.healthConfig.prediction.enabled) {
                this.intervals.prediction = setInterval(() => {
                    this.performPredictiveAnalysis();
                }, this.healthConfig.prediction.lookbackWindow);
            }
            
            this.isMonitoring = true;
            
            // Perform initial health check
            await this.performHealthCheck();
            
            this.logger.info('Health monitoring started', {
                checkInterval: this.healthConfig.checkInterval,
                reportInterval: this.healthConfig.reportInterval
            });
            
            this.emit('health:monitoring:started', { timestamp: Date.now() });
            
        } catch (error) {
            this.logger.error('Failed to start health monitoring', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Stop health monitoring
     */
    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        try {
            // Clear all intervals
            Object.values(this.intervals).forEach(interval => {
                if (interval) clearInterval(interval);
            });
            this.intervals = {
                healthCheck: null,
                reporting: null,
                aggregation: null,
                prediction: null
            };
            
            this.isMonitoring = false;
            
            this.logger.info('Health monitoring stopped');
            this.emit('health:monitoring:stopped', { timestamp: Date.now() });
            
        } catch (error) {
            this.logger.error('Failed to stop health monitoring', { error: error.message });
        }
    }
    
    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        try {
            const startTime = Date.now();
            this.stats.totalHealthChecks++;
            
            // Check all protection systems
            const protectionResults = await this.checkProtectionSystems();
            
            // Check all registered components
            const componentResults = await this.checkComponents();
            
            // Calculate overall system health
            const systemHealth = this.calculateSystemHealth(protectionResults, componentResults);
            
            // Update health state
            this.updateSystemHealth(systemHealth);
            
            // Check for health level changes
            this.checkHealthLevelChanges(systemHealth);
            
            // Store health check results
            this.storeHealthResults({
                timestamp: startTime,
                duration: Date.now() - startTime,
                systemHealth,
                protectionResults,
                componentResults
            });
            
            this.lastHealthCheck = Date.now();
            
            this.emit('health:check:completed', {
                timestamp: startTime,
                duration: Date.now() - startTime,
                systemHealth,
                componentsChecked: this.components.size + this.protectionSystems.size
            });
            
        } catch (error) {
            this.logger.error('Error during health check', {
                error: error.message,
                stack: error.stack
            });
            
            this.emit('health:check:failed', {
                timestamp: Date.now(),
                error: error.message
            });
        }
    }
    
    /**
     * Check all protection systems health
     */
    async checkProtectionSystems() {
        const results = new Map();
        
        for (const [systemId, systemInfo] of this.protectionSystems) {
            try {
                const healthResult = await this.healthChecker.checkProtectionSystemHealth(
                    systemId,
                    systemInfo.system,
                    systemInfo.config
                );
                
                results.set(systemId, healthResult);
                
                // Update system info
                systemInfo.lastCheck = Date.now();
                systemInfo.status = healthResult.status;
                systemInfo.metrics = healthResult.metrics;
                
                // Update health metrics
                this.healthMetrics.system.protection.set(systemId, healthResult);
                
            } catch (error) {
                this.logger.error(`Error checking protection system health: ${systemId}`, {
                    error: error.message
                });
                
                results.set(systemId, {
                    status: 'failed',
                    score: 0,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
        
        return results;
    }
    
    /**
     * Check all registered components health
     */
    async checkComponents() {
        const results = new Map();
        
        for (const [componentId, componentInfo] of this.components) {
            try {
                const healthResult = await this.healthChecker.checkComponentHealth(
                    componentId,
                    componentInfo.component,
                    componentInfo.config
                );
                
                results.set(componentId, healthResult);
                
                // Update component info
                componentInfo.lastCheck = Date.now();
                componentInfo.status = healthResult.status;
                componentInfo.metrics = healthResult.metrics;
                
                // Update health state
                const healthState = this.healthStates.get(componentId);
                if (healthState) {
                    healthState.status = healthResult.status;
                    healthState.score = healthResult.score;
                    healthState.lastUpdate = Date.now();
                    healthState.history.push({
                        timestamp: Date.now(),
                        status: healthResult.status,
                        score: healthResult.score
                    });
                    
                    // Limit history size
                    if (healthState.history.length > this.healthConfig.retention.healthHistory) {
                        healthState.history.shift();
                    }
                }
                
                // Update health metrics
                this.healthMetrics.system.components.set(componentId, healthResult);
                
            } catch (error) {
                this.logger.error(`Error checking component health: ${componentId}`, {
                    error: error.message
                });
                
                results.set(componentId, {
                    status: 'failed',
                    score: 0,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
        
        return results;
    }
    
    /**
     * Calculate overall system health score and status
     */
    calculateSystemHealth(protectionResults, componentResults) {
        const allResults = new Map([...protectionResults, ...componentResults]);
        
        if (allResults.size === 0) {
            return { status: 'unknown', score: 0, details: {} };
        }
        
        // Calculate weighted health score
        let totalScore = 0;
        let totalWeight = 0;
        const categoryScores = { critical: 0, high: 0, medium: 0, low: 0 };
        const categoryCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        
        for (const [componentId, result] of allResults) {
            const priority = this.getComponentPriority(componentId);
            const weight = this.getPriorityWeight(priority);
            
            totalScore += result.score * weight;
            totalWeight += weight;
            
            categoryScores[priority] += result.score;
            categoryCounts[priority]++;
        }
        
        const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        
        // Calculate category averages
        const categoryAverages = {};
        for (const category of Object.keys(categoryScores)) {
            categoryAverages[category] = categoryCounts[category] > 0 
                ? categoryScores[category] / categoryCounts[category] 
                : 1;
        }
        
        // Determine status based on score and thresholds
        const status = this.determineHealthStatus(overallScore, categoryAverages);
        
        return {
            status,
            score: overallScore,
            categoryAverages,
            totalComponents: allResults.size,
            failedComponents: Array.from(allResults.entries())
                .filter(([_, result]) => result.status === 'failed' || result.status === 'critical')
                .map(([id]) => id),
            details: {
                protection: Object.fromEntries(protectionResults),
                components: Object.fromEntries(componentResults)
            },
            timestamp: Date.now()
        };
    }
    
    /**
     * Get component priority for health calculation
     */
    getComponentPriority(componentId) {
        // Check protection systems
        const protectionSystem = this.protectionSystems.get(componentId);
        if (protectionSystem) {
            return protectionSystem.config.priority;
        }
        
        // Check regular components
        const component = this.components.get(componentId);
        if (component) {
            return component.config.priority;
        }
        
        return 'medium'; // default
    }
    
    /**
     * Get weight for priority level
     */
    getPriorityWeight(priority) {
        const weights = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1
        };
        return weights[priority] || 2;
    }
    
    /**
     * Determine health status based on score and category health
     */
    determineHealthStatus(overallScore, categoryAverages) {
        const thresholds = this.healthConfig.thresholds;
        
        // Critical components must be healthy
        if (categoryAverages.critical < thresholds.critical) {
            return 'critical';
        }
        
        // Check overall score against thresholds
        if (overallScore >= thresholds.healthy) {
            return 'healthy';
        } else if (overallScore >= thresholds.warning) {
            return 'warning';
        } else if (overallScore >= thresholds.degraded) {
            return 'degraded';
        } else if (overallScore >= thresholds.critical) {
            return 'critical';
        } else {
            return 'failed';
        }
    }
    
    /**
     * Update system health state
     */
    updateSystemHealth(systemHealth) {
        const previousHealth = this.healthMetrics.system.overall;
        
        this.healthMetrics.system.overall = systemHealth;
        
        // Check for status change
        if (previousHealth.status !== systemHealth.status) {
            this.stats.systemStateChanges++;
            
            this.logger.info(`System health status changed: ${previousHealth.status} -> ${systemHealth.status}`, {
                score: systemHealth.score,
                failedComponents: systemHealth.failedComponents
            });
            
            this.emit('health:system:changed', {
                previous: previousHealth,
                current: systemHealth,
                timestamp: Date.now()
            });
        }
        
        // Check for emergency conditions
        if (systemHealth.status === 'critical' || systemHealth.status === 'failed') {
            if (!this.emergencyState.isActive) {
                this.activateEmergencyMode(systemHealth);
            }
        } else if (this.emergencyState.isActive && systemHealth.status === 'healthy') {
            this.resolveEmergencyMode(systemHealth);
        }
    }
    
    /**
     * Store health check results in history
     */
    storeHealthResults(results) {
        this.healthMetrics.history.push(results);
        
        // Limit history size
        if (this.healthMetrics.history.length > this.healthConfig.retention.metricHistory) {
            this.healthMetrics.history.shift();
        }
    }
    
    /**
     * Generate comprehensive health report
     */
    async generateHealthReport() {
        try {
            const report = await this.healthReporter.generateReport(
                this.healthMetrics,
                this.alertState,
                this.stats
            );
            
            this.lastReport = Date.now();
            
            this.emit('health:report:generated', {
                report,
                timestamp: Date.now()
            });
            
            return report;
            
        } catch (error) {
            this.logger.error('Error generating health report', {
                error: error.message
            });
        }
    }
    
    /**
     * Aggregate metrics from all systems
     */
    async aggregateMetrics() {
        try {
            // Aggregate protection system metrics
            for (const [systemId, systemInfo] of this.protectionSystems) {
                if (systemInfo.config.metrics && typeof systemInfo.config.metrics === 'function') {
                    const metrics = await systemInfo.config.metrics();
                    this.healthMetrics.system.protection.set(systemId, {
                        ...this.healthMetrics.system.protection.get(systemId),
                        metrics,
                        timestamp: Date.now()
                    });
                }
            }
            
            // Aggregate component metrics
            for (const [componentId, componentInfo] of this.components) {
                if (componentInfo.config.metrics && typeof componentInfo.config.metrics === 'function') {
                    const metrics = await componentInfo.config.metrics();
                    this.healthMetrics.system.components.set(componentId, {
                        ...this.healthMetrics.system.components.get(componentId),
                        metrics,
                        timestamp: Date.now()
                    });
                }
            }
            
            // Update performance metrics
            this.updatePerformanceMetrics();
            
        } catch (error) {
            this.logger.error('Error aggregating metrics', {
                error: error.message
            });
        }
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.healthMetrics.system.performance.set('system', {
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                heapUsedPercent: memoryUsage.heapUsed / memoryUsage.heapTotal,
                external: memoryUsage.external
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            timestamp: Date.now()
        });
    }
    
    /**
     * Perform predictive analysis
     */
    async performPredictiveAnalysis() {
        if (!this.healthConfig.prediction.enabled) {
            return;
        }
        
        try {
            const predictions = await this.healthReporter.generatePredictions(
                this.healthMetrics,
                this.healthConfig.prediction
            );
            
            this.healthMetrics.predictions = predictions;
            
            // Check for concerning trends
            for (const [componentId, prediction] of Object.entries(predictions)) {
                if (prediction.risk === 'high' || prediction.risk === 'critical') {
                    this.emit('health:prediction:concern', {
                        componentId,
                        prediction,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('Error performing predictive analysis', {
                error: error.message
            });
        }
    }
    
    /**
     * Activate emergency mode
     */
    activateEmergencyMode(systemHealth) {
        this.emergencyState = {
            isActive: true,
            triggeredBy: systemHealth.failedComponents,
            startTime: Date.now(),
            actions: [],
            recoveryPlan: this.createRecoveryPlan(systemHealth)
        };
        
        this.logger.error('Emergency mode activated', {
            systemHealth: systemHealth.status,
            score: systemHealth.score,
            failedComponents: systemHealth.failedComponents,
            recoveryPlan: this.emergencyState.recoveryPlan
        });
        
        this.emit('health:emergency:activated', {
            systemHealth,
            emergencyState: this.emergencyState,
            timestamp: Date.now()
        });
    }
    
    /**
     * Resolve emergency mode
     */
    resolveEmergencyMode(systemHealth) {
        const duration = Date.now() - this.emergencyState.startTime;
        
        this.logger.info('Emergency mode resolved', {
            duration,
            systemHealth: systemHealth.status,
            score: systemHealth.score,
            actions: this.emergencyState.actions.length
        });
        
        this.emit('health:emergency:resolved', {
            systemHealth,
            duration,
            actions: this.emergencyState.actions,
            timestamp: Date.now()
        });
        
        this.emergencyState = {
            isActive: false,
            triggeredBy: null,
            startTime: null,
            actions: [],
            recoveryPlan: null
        };
    }
    
    /**
     * Create recovery plan for emergency situations
     */
    createRecoveryPlan(systemHealth) {
        const plan = {
            priority: 'emergency',
            steps: [],
            estimatedTime: 0
        };
        
        // Plan for failed critical components
        for (const componentId of systemHealth.failedComponents) {
            const priority = this.getComponentPriority(componentId);
            
            if (priority === 'critical') {
                plan.steps.push({
                    action: 'restart_component',
                    target: componentId,
                    priority: 'immediate',
                    estimatedTime: 30000 // 30 seconds
                });
            }
        }
        
        // Add fallback steps
        if (systemHealth.score < 0.3) {
            plan.steps.push({
                action: 'enable_safe_mode',
                priority: 'high',
                estimatedTime: 10000 // 10 seconds
            });
        }
        
        plan.estimatedTime = plan.steps.reduce((total, step) => total + step.estimatedTime, 0);
        
        return plan;
    }
    
    // ===== Event Handlers =====
    
    handleComponentHealthChange(data) {
        this.logger.debug(`Component health changed: ${data.componentId}`, {
            status: data.status,
            score: data.score
        });
    }
    
    handleComponentCritical(data) {
        this.stats.componentFailures++;
        
        this.logger.error(`Component critical: ${data.componentId}`, {
            status: data.status,
            error: data.error
        });
        
        // Trigger circuit breaker if configured
        this.triggerCircuitBreaker(data.componentId, data);
    }
    
    handleComponentRecovery(data) {
        this.stats.recoveries++;
        
        this.logger.info(`Component recovered: ${data.componentId}`, {
            status: data.status,
            score: data.score
        });
        
        // Reset circuit breaker if it was open
        this.resetCircuitBreaker(data.componentId);
    }
    
    handleCircuitBreakerOpened(data) {
        this.circuitBreakers.set(data.componentId, {
            isOpen: true,
            openedAt: Date.now(),
            reason: data.reason
        });
        
        this.logger.warn(`Circuit breaker opened for: ${data.componentId}`, {
            reason: data.reason
        });
    }
    
    handleCircuitBreakerClosed(data) {
        const breaker = this.circuitBreakers.get(data.componentId);
        if (breaker) {
            const duration = Date.now() - breaker.openedAt;
            this.logger.info(`Circuit breaker closed for: ${data.componentId}`, {
                duration
            });
        }
        
        this.circuitBreakers.delete(data.componentId);
    }
    
    handleAlertTriggered(data) {
        this.stats.totalAlerts++;
        
        this.alertState.active.set(data.alertId, data);
        this.alertState.history.push({
            ...data,
            action: 'triggered',
            timestamp: Date.now()
        });
        
        this.logger.warn(`Alert triggered: ${data.alertId}`, {
            level: data.level,
            message: data.message
        });
    }
    
    handleAlertResolved(data) {
        this.alertState.active.delete(data.alertId);
        this.alertState.history.push({
            ...data,
            action: 'resolved',
            timestamp: Date.now()
        });
        
        this.logger.info(`Alert resolved: ${data.alertId}`);
    }
    
    handleTrendDetected(data) {
        this.healthMetrics.trends.set(data.componentId, data);
        
        this.logger.info(`Trend detected: ${data.componentId}`, {
            trend: data.trend,
            confidence: data.confidence
        });
    }
    
    handlePredictionGenerated(data) {
        this.healthMetrics.predictions.set(data.componentId, data);
        
        if (data.risk === 'high' || data.risk === 'critical') {
            this.logger.warn(`High risk prediction: ${data.componentId}`, {
                prediction: data.prediction,
                confidence: data.confidence
            });
        }
    }
    
    handleSystemHealthChange(data) {
        this.currentHealthLevel = data.current.status;
        
        // Update dashboard if available
        this.emit('health:dashboard:update', {
            systemHealth: data.current,
            components: Object.fromEntries(this.healthStates),
            alerts: Array.from(this.alertState.active.values()),
            timestamp: Date.now()
        });
    }
    
    handleEmergencyActivated(data) {
        // Emergency actions could be implemented here
        // For now, just log and emit events
    }
    
    handleEmergencyResolved(data) {
        // Recovery actions could be implemented here
        // For now, just log and emit events
    }
    
    // ===== Circuit Breaker Management =====
    
    triggerCircuitBreaker(componentId, reason) {
        this.healthChecker.openCircuitBreaker(componentId, reason);
    }
    
    resetCircuitBreaker(componentId) {
        this.healthChecker.closeCircuitBreaker(componentId);
    }
    
    // ===== Built-in Health Checks =====
    
    checkMemoryManagerHealth(memoryManager) {
        const stats = memoryManager.getMemoryStats();
        const isHealthy = !stats.system.emergencyMode && stats.system.isMonitoring;
        
        return {
            status: isHealthy ? 'healthy' : 'critical',
            score: isHealthy ? 1 : 0,
            metrics: stats,
            details: {
                emergencyMode: stats.system.emergencyMode,
                monitoring: stats.system.isMonitoring,
                currentPressure: stats.system.currentPressureLevel
            }
        };
    }
    
    checkStackMonitorHealth(stackMonitor) {
        const stats = stackMonitor.getStatistics();
        const status = stackMonitor.getStatus();
        
        const isHealthy = status.isEnabled && !status.isInEmergency;
        
        return {
            status: isHealthy ? 'healthy' : 'warning',
            score: isHealthy ? 1 : 0.5,
            metrics: stats,
            details: {
                enabled: status.isEnabled,
                emergency: status.isInEmergency,
                currentDepth: status.currentDepth,
                recursionDetections: stats.recursionDetections
            }
        };
    }
    
    checkEventBusHealth(eventBus) {
        const stats = eventBus.getStats();
        const protectionStatus = eventBus.getRecursionProtectionStatus();
        
        const isHealthy = protectionStatus.isHealthy && !protectionStatus.circuitBreakerOpen;
        
        return {
            status: isHealthy ? 'healthy' : 'degraded',
            score: isHealthy ? 1 : 0.7,
            metrics: stats,
            details: {
                circuitBreaker: protectionStatus.circuitBreakerOpen,
                stackDepth: protectionStatus.currentStackDepth,
                activeChains: protectionStatus.activeChains
            }
        };
    }
    
    checkErrorHandlerHealth(errorHandler) {
        const status = errorHandler.getStatus();
        
        const isHealthy = !status.emergencyMode && status.disabledModules.length === 0;
        
        return {
            status: isHealthy ? 'healthy' : 'warning',
            score: isHealthy ? 1 : 0.6,
            metrics: status,
            details: {
                emergencyMode: status.emergencyMode,
                disabledModules: status.disabledModules.length,
                pendingRecovery: status.pendingRecovery.length
            }
        };
    }
    
    checkPerformanceMonitorHealth(performanceMonitor) {
        const summary = performanceMonitor.getSummary();
        
        // Simple health check - monitoring is running
        const isHealthy = true; // Performance monitor doesn't have failure states
        
        return {
            status: 'healthy',
            score: 1,
            metrics: summary,
            details: {
                monitoring: 'active',
                modulesTracked: Object.keys(summary.modules || {}).length
            }
        };
    }
    
    checkDatabaseHealth(database) {
        // Basic database health check
        return new Promise((resolve) => {
            database.get('SELECT 1', (err) => {
                if (err) {
                    resolve({
                        status: 'failed',
                        score: 0,
                        error: err.message,
                        details: { connection: 'failed' }
                    });
                } else {
                    resolve({
                        status: 'healthy',
                        score: 1,
                        details: { connection: 'ok' }
                    });
                }
            });
        });
    }
    
    getDatabaseMetrics(database) {
        // Placeholder for database metrics
        return {
            connection: 'ok',
            queries: 0,
            errors: 0
        };
    }
    
    checkModuleRegistryHealth(moduleRegistry) {
        const modules = moduleRegistry.getAll();
        const startedModules = modules.filter(m => m.status === 'started').length;
        const failedModules = modules.filter(m => m.status === 'failed').length;
        
        const healthScore = modules.length > 0 ? startedModules / modules.length : 1;
        
        let status = 'healthy';
        if (healthScore < 0.7) status = 'critical';
        else if (healthScore < 0.9) status = 'warning';
        
        return {
            status,
            score: healthScore,
            metrics: {
                total: modules.length,
                started: startedModules,
                failed: failedModules
            },
            details: {
                modulesRunning: startedModules,
                modulesFailed: failedModules
            }
        };
    }
    
    getModuleRegistryMetrics(moduleRegistry) {
        const modules = moduleRegistry.getAll();
        
        return {
            totalModules: modules.length,
            runningModules: modules.filter(m => m.status === 'started').length,
            failedModules: modules.filter(m => m.status === 'failed').length,
            stoppedModules: modules.filter(m => m.status === 'stopped').length
        };
    }
    
    // ===== Public API =====
    
    /**
     * Get comprehensive system health status
     */
    getSystemHealth() {
        return {
            ...this.healthMetrics.system.overall,
            emergency: this.emergencyState,
            circuitBreakers: Object.fromEntries(this.circuitBreakers),
            monitoring: {
                isActive: this.isMonitoring,
                lastCheck: this.lastHealthCheck,
                lastReport: this.lastReport
            }
        };
    }
    
    /**
     * Get component health details
     */
    getComponentHealth(componentId) {
        if (componentId) {
            return this.healthStates.get(componentId);
        }
        
        return Object.fromEntries(this.healthStates);
    }
    
    /**
     * Get protection system status
     */
    getProtectionSystemStatus() {
        const status = {};
        
        for (const [systemId, systemInfo] of this.protectionSystems) {
            status[systemId] = {
                status: systemInfo.status,
                lastCheck: systemInfo.lastCheck,
                metrics: systemInfo.metrics,
                circuitBreaker: systemInfo.circuitBreaker
            };
        }
        
        return status;
    }
    
    /**
     * Get health dashboard data
     */
    getHealthDashboard() {
        return {
            system: this.getSystemHealth(),
            components: this.getComponentHealth(),
            protectionSystems: this.getProtectionSystemStatus(),
            alerts: {
                active: Array.from(this.alertState.active.values()),
                recent: this.alertState.history.slice(-10)
            },
            metrics: {
                trends: Object.fromEntries(this.healthMetrics.trends),
                predictions: Object.fromEntries(this.healthMetrics.predictions),
                performance: Object.fromEntries(this.healthMetrics.system.performance)
            },
            stats: {
                ...this.stats,
                uptime: Date.now() - this.stats.startTime
            }
        };
    }
    
    /**
     * Get health history
     */
    getHealthHistory(limit = 100) {
        return this.healthMetrics.history.slice(-limit);
    }
    
    /**
     * Force health check
     */
    async forceHealthCheck() {
        return await this.performHealthCheck();
    }
    
    /**
     * Force health report generation
     */
    async forceHealthReport() {
        return await this.generateHealthReport();
    }
    
    /**
     * Get health configuration
     */
    getHealthConfig() {
        return { ...this.healthConfig };
    }
    
    /**
     * Update health configuration
     */
    updateHealthConfig(newConfig) {
        this.healthConfig = { ...this.healthConfig, ...newConfig };
        
        this.logger.info('Health monitoring configuration updated');
        this.emit('health:config:updated', this.healthConfig);
    }
    
    /**
     * Shutdown health monitoring system
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Health Monitoring System');
            
            // Stop monitoring
            await this.stopMonitoring();
            
            // Shutdown components
            if (this.healthChecker) {
                await this.healthChecker.shutdown();
            }
            
            if (this.healthReporter) {
                await this.healthReporter.shutdown();
            }
            
            // Clear state
            this.components.clear();
            this.healthStates.clear();
            this.protectionSystems.clear();
            this.circuitBreakers.clear();
            this.alertState.active.clear();
            
            // Remove all listeners
            this.removeAllListeners();
            
            this.isInitialized = false;
            this.logger.info('Health Monitoring System shut down successfully');
            
        } catch (error) {
            this.logger.error('Error shutting down Health Monitoring System', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}

export default HealthMonitor;