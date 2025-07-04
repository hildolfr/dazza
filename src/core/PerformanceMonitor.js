const { EventEmitter } = require('events');

class PerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            sampleInterval: 60000, // 1 minute
            maxSamples: 1440, // 24 hours at 1 minute intervals
            memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
            cpuWarningThreshold: 80, // 80%
            ...config
        };
        
        // Metrics storage
        this.metrics = {
            modules: new Map(), // moduleId -> metrics
            system: {
                samples: [],
                current: {}
            }
        };
        
        // Start monitoring
        this.startMonitoring();
    }
    
    // ===== Module Metrics =====
    
    initModuleMetrics(moduleId) {
        if (!this.metrics.modules.has(moduleId)) {
            this.metrics.modules.set(moduleId, {
                events: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byEvent: new Map()
                },
                api: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byRoute: new Map()
                },
                database: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byQuery: new Map()
                },
                tasks: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byTask: new Map()
                },
                errors: {
                    count: 0,
                    byType: new Map()
                },
                memory: {
                    current: 0,
                    peak: 0,
                    samples: []
                }
            });
        }
    }
    
    recordEvent(moduleId, event, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).events;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by event
        if (!metrics.byEvent.has(event)) {
            metrics.byEvent.set(event, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const eventMetrics = metrics.byEvent.get(event);
        eventMetrics.count++;
        eventMetrics.totalDuration += duration;
        eventMetrics.avgDuration = eventMetrics.totalDuration / eventMetrics.count;
        eventMetrics.maxDuration = Math.max(eventMetrics.maxDuration, duration);
        
        // Check for slow events
        if (duration > 1000) { // 1 second
            this.emit('performance:slow-event', {
                moduleId,
                event,
                duration
            });
        }
    }
    
    recordApiCall(moduleId, route, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).api;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by route
        if (!metrics.byRoute.has(route)) {
            metrics.byRoute.set(route, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const routeMetrics = metrics.byRoute.get(route);
        routeMetrics.count++;
        routeMetrics.totalDuration += duration;
        routeMetrics.avgDuration = routeMetrics.totalDuration / routeMetrics.count;
        routeMetrics.maxDuration = Math.max(routeMetrics.maxDuration, duration);
        
        // Check for slow API calls
        if (duration > 3000) { // 3 seconds
            this.emit('performance:slow-api', {
                moduleId,
                route,
                duration
            });
        }
    }
    
    recordQuery(moduleId, queryType, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).database;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by query type
        if (!metrics.byQuery.has(queryType)) {
            metrics.byQuery.set(queryType, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const queryMetrics = metrics.byQuery.get(queryType);
        queryMetrics.count++;
        queryMetrics.totalDuration += duration;
        queryMetrics.avgDuration = queryMetrics.totalDuration / queryMetrics.count;
        queryMetrics.maxDuration = Math.max(queryMetrics.maxDuration, duration);
        
        // Check for slow queries
        if (duration > 500) { // 500ms
            this.emit('performance:slow-query', {
                moduleId,
                queryType,
                duration
            });
        }
    }
    
    recordTask(moduleId, taskName, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).tasks;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by task
        if (!metrics.byTask.has(taskName)) {
            metrics.byTask.set(taskName, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const taskMetrics = metrics.byTask.get(taskName);
        taskMetrics.count++;
        taskMetrics.totalDuration += duration;
        taskMetrics.avgDuration = taskMetrics.totalDuration / taskMetrics.count;
        taskMetrics.maxDuration = Math.max(taskMetrics.maxDuration, duration);
    }
    
    recordError(moduleId, errorType) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).errors;
        
        metrics.count++;
        
        const count = metrics.byType.get(errorType) || 0;
        metrics.byType.set(errorType, count + 1);
    }
    
    // ===== System Monitoring =====
    
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.sampleInterval);
        
        // Initial collection
        this.collectSystemMetrics();
    }
    
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    
    collectSystemMetrics() {
        const usage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const sample = {
            timestamp: Date.now(),
            memory: {
                rss: usage.rss,
                heapTotal: usage.heapTotal,
                heapUsed: usage.heapUsed,
                external: usage.external,
                arrayBuffers: usage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            }
        };
        
        // Store sample
        this.metrics.system.samples.push(sample);
        if (this.metrics.system.samples.length > this.config.maxSamples) {
            this.metrics.system.samples.shift();
        }
        
        // Update current
        this.metrics.system.current = sample;
        
        // Check thresholds
        if (usage.heapUsed > this.config.memoryWarningThreshold) {
            this.emit('performance:memory-warning', {
                used: usage.heapUsed,
                threshold: this.config.memoryWarningThreshold
            });
        }
        
        // Calculate module memory (approximate)
        this.updateModuleMemory();
    }
    
    updateModuleMemory() {
        // This is a simplified approach - in reality, you'd need more sophisticated tracking
        const totalModules = this.metrics.modules.size;
        if (totalModules === 0) return;
        
        const heapUsed = process.memoryUsage().heapUsed;
        const baseMemory = 50 * 1024 * 1024; // Assume 50MB base
        const moduleMemory = (heapUsed - baseMemory) / totalModules;
        
        for (const [moduleId, metrics] of this.metrics.modules.entries()) {
            metrics.memory.current = moduleMemory;
            metrics.memory.peak = Math.max(metrics.memory.peak, moduleMemory);
            
            metrics.memory.samples.push({
                timestamp: Date.now(),
                value: moduleMemory
            });
            
            if (metrics.memory.samples.length > 60) { // Keep last hour
                metrics.memory.samples.shift();
            }
        }
    }
    
    // ===== Reporting =====
    
    getModuleReport(moduleId) {
        const metrics = this.metrics.modules.get(moduleId);
        if (!metrics) return null;
        
        return {
            events: {
                ...metrics.events,
                byEvent: Object.fromEntries(metrics.events.byEvent)
            },
            api: {
                ...metrics.api,
                byRoute: Object.fromEntries(metrics.api.byRoute)
            },
            database: {
                ...metrics.database,
                byQuery: Object.fromEntries(metrics.database.byQuery)
            },
            tasks: {
                ...metrics.tasks,
                byTask: Object.fromEntries(metrics.tasks.byTask)
            },
            errors: {
                ...metrics.errors,
                byType: Object.fromEntries(metrics.errors.byType)
            },
            memory: metrics.memory
        };
    }
    
    getSystemReport() {
        const current = this.metrics.system.current;
        const samples = this.metrics.system.samples;
        
        // Calculate averages
        let avgMemory = 0;
        let peakMemory = 0;
        
        if (samples.length > 0) {
            const totalMemory = samples.reduce((sum, s) => sum + s.memory.heapUsed, 0);
            avgMemory = totalMemory / samples.length;
            peakMemory = Math.max(...samples.map(s => s.memory.heapUsed));
        }
        
        return {
            current,
            average: {
                memory: avgMemory
            },
            peak: {
                memory: peakMemory
            },
            samples: samples.slice(-60) // Last hour
        };
    }
    
    getSummary() {
        const moduleReports = {};
        
        for (const [moduleId] of this.metrics.modules.entries()) {
            moduleReports[moduleId] = this.getModuleReport(moduleId);
        }
        
        return {
            system: this.getSystemReport(),
            modules: moduleReports
        };
    }
    
    reset(moduleId = null) {
        if (moduleId) {
            this.metrics.modules.delete(moduleId);
        } else {
            this.metrics.modules.clear();
            this.metrics.system.samples = [];
        }
    }
}

module.exports = PerformanceMonitor;