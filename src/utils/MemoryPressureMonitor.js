import { EventEmitter } from 'events';
import v8 from 'v8';
import os from 'os';

/**
 * Memory Pressure Monitor
 * Advanced memory monitoring with configurable thresholds and pressure tracking
 * Provides real-time memory usage tracking with automatic cleanup triggers
 */
export class MemoryPressureMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Memory thresholds (percentage of heap limit)
        this.thresholds = {
            warning: options.warningThreshold || 0.80,     // 80% - warning level
            critical: options.criticalThreshold || 0.90,   // 90% - critical level
            emergency: options.emergencyThreshold || 0.95   // 95% - emergency level
        };
        
        // Monitoring configuration
        this.config = {
            checkInterval: options.checkInterval || 30000,        // 30 seconds
            historySize: options.historySize || 100,              // Keep 100 samples
            pressureWindow: options.pressureWindow || 10,         // 10 samples for pressure calculation
            leakDetectionWindow: options.leakDetectionWindow || 15, // 15 samples for leak detection
            leakGrowthThreshold: options.leakGrowthThreshold || 0.03, // 3% growth per sample
            gcEfficiencyThreshold: options.gcEfficiencyThreshold || 0.10, // 10% minimum GC efficiency
            alertCooldown: options.alertCooldown || 300000,       // 5 minutes between alerts
            emergencyCooldown: options.emergencyCooldown || 60000  // 1 minute between emergency alerts
        };
        
        // State tracking
        this.isMonitoring = false;
        this.monitorInterval = null;
        this.history = [];
        this.pressureHistory = [];
        this.currentPressureLevel = 'normal';
        this.lastAlerts = {
            warning: 0,
            critical: 0,
            emergency: 0
        };
        
        // Memory statistics
        this.stats = {
            startTime: Date.now(),
            totalSamples: 0,
            gcCount: 0,
            lastGCTime: null,
            pressureEvents: {
                warning: 0,
                critical: 0,
                emergency: 0
            },
            leakDetectionCount: 0,
            emergencyActionsCount: 0
        };
        
        // Component memory tracking
        this.componentMemory = new Map();
        this.componentSizeGetters = new Map();
        
        // RSS and External memory tracking
        this.rssThreshold = options.rssThreshold || 1024 * 1024 * 1024; // 1GB RSS threshold
        this.externalThreshold = options.externalThreshold || 512 * 1024 * 1024; // 512MB external threshold
        
        // Setup GC tracking if available
        if (global.gc) {
            this.setupGCTracking();
        }
    }
    
    /**
     * Start memory pressure monitoring
     */
    start() {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        this.stats.startTime = Date.now();
        
        // Take initial sample
        this.takeSample();
        
        // Start monitoring interval
        this.monitorInterval = setInterval(() => {
            this.takeSample();
            this.analyzePressure();
            this.detectMemoryLeaks();
            this.checkEmergencyConditions();
        }, this.config.checkInterval);
        
        this.emit('monitoring:started', {
            thresholds: this.thresholds,
            config: this.config
        });
    }
    
    /**
     * Stop memory pressure monitoring
     */
    stop() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        this.emit('monitoring:stopped', {
            totalSamples: this.stats.totalSamples,
            uptime: Date.now() - this.stats.startTime
        });
    }
    
    /**
     * Take a memory sample
     */
    takeSample() {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        const heapSpaces = v8.getHeapSpaceStatistics();
        const systemMem = {
            total: os.totalmem(),
            free: os.freemem()
        };
        
        const timestamp = Date.now();
        
        // Calculate derived metrics
        const heapUsagePercent = (heapStats.used_heap_size / heapStats.heap_size_limit);
        const rssUsageMB = Math.round(memUsage.rss / 1024 / 1024);
        const externalUsageMB = Math.round(memUsage.external / 1024 / 1024);
        const systemUsagePercent = (systemMem.total - systemMem.free) / systemMem.total;
        
        // Component memory tracking
        const componentMemory = {};
        for (const [name, getter] of this.componentSizeGetters) {
            try {
                componentMemory[name] = typeof getter === 'function' ? getter() : getter;
            } catch (error) {
                componentMemory[name] = 'error';
            }
        }
        
        const sample = {
            timestamp,
            heap: {
                used: heapStats.used_heap_size,
                total: heapStats.total_heap_size,
                limit: heapStats.heap_size_limit,
                available: heapStats.total_available_size,
                usagePercent: heapUsagePercent,
                usedMB: Math.round(heapStats.used_heap_size / 1024 / 1024),
                totalMB: Math.round(heapStats.total_heap_size / 1024 / 1024),
                limitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024)
            },
            process: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers,
                rssMB: rssUsageMB,
                externalMB: externalUsageMB
            },
            system: {
                total: systemMem.total,
                free: systemMem.free,
                usagePercent: systemUsagePercent,
                totalMB: Math.round(systemMem.total / 1024 / 1024),
                freeMB: Math.round(systemMem.free / 1024 / 1024)
            },
            heapSpaces: heapSpaces.map(space => ({
                name: space.space_name,
                size: space.space_size,
                used: space.space_used_size,
                available: space.space_available_size,
                usagePercent: space.space_used_size / space.space_size
            })),
            components: componentMemory,
            gc: {
                count: this.stats.gcCount,
                lastGCTime: this.stats.lastGCTime
            }
        };
        
        // Add to history
        this.history.push(sample);
        if (this.history.length > this.config.historySize) {
            this.history.shift();
        }
        
        this.stats.totalSamples++;
        
        // Determine pressure level
        const pressureLevel = this.calculatePressureLevel(sample);
        if (pressureLevel !== this.currentPressureLevel) {
            this.currentPressureLevel = pressureLevel;
            this.emit('pressure:changed', {
                from: this.currentPressureLevel,
                to: pressureLevel,
                sample
            });
        }
        
        this.emit('sample:taken', sample);
        
        return sample;
    }
    
    /**
     * Calculate current memory pressure level
     */
    calculatePressureLevel(sample) {
        const heapPercent = sample.heap.usagePercent;
        const rssOverLimit = sample.process.rss > this.rssThreshold;
        const externalOverLimit = sample.process.external > this.externalThreshold;
        
        if (heapPercent >= this.thresholds.emergency || rssOverLimit || externalOverLimit) {
            return 'emergency';
        } else if (heapPercent >= this.thresholds.critical) {
            return 'critical';
        } else if (heapPercent >= this.thresholds.warning) {
            return 'warning';
        } else {
            return 'normal';
        }
    }
    
    /**
     * Analyze memory pressure and trigger alerts
     */
    analyzePressure() {
        const latest = this.getLatestSample();
        if (!latest) return;
        
        const now = Date.now();
        const pressureLevel = this.currentPressureLevel;
        
        // Check if we should emit alerts based on cooldown
        const shouldAlert = (alertType) => {
            const cooldown = alertType === 'emergency' ? 
                this.config.emergencyCooldown : this.config.alertCooldown;
            return (now - this.lastAlerts[alertType]) > cooldown;
        };
        
        // Calculate pressure metrics
        const pressureMetrics = this.calculatePressureMetrics(latest);
        
        // Emit appropriate alerts
        if (pressureLevel === 'emergency' && shouldAlert('emergency')) {
            this.lastAlerts.emergency = now;
            this.stats.pressureEvents.emergency++;
            this.emit('pressure:emergency', {
                level: 'emergency',
                sample: latest,
                metrics: pressureMetrics,
                recommendation: 'Immediate action required - memory critically low'
            });
        } else if (pressureLevel === 'critical' && shouldAlert('critical')) {
            this.lastAlerts.critical = now;
            this.stats.pressureEvents.critical++;
            this.emit('pressure:critical', {
                level: 'critical',
                sample: latest,
                metrics: pressureMetrics,
                recommendation: 'Critical memory pressure - initiate cleanup'
            });
        } else if (pressureLevel === 'warning' && shouldAlert('warning')) {
            this.lastAlerts.warning = now;
            this.stats.pressureEvents.warning++;
            this.emit('pressure:warning', {
                level: 'warning',
                sample: latest,
                metrics: pressureMetrics,
                recommendation: 'Memory pressure detected - monitor closely'
            });
        }
        
        // Track pressure history
        this.pressureHistory.push({
            timestamp: now,
            level: pressureLevel,
            heapPercent: latest.heap.usagePercent,
            rssPercent: latest.process.rss / this.rssThreshold
        });
        
        if (this.pressureHistory.length > this.config.pressureWindow) {
            this.pressureHistory.shift();
        }
    }
    
    /**
     * Calculate pressure metrics for detailed analysis
     */
    calculatePressureMetrics(sample) {
        const recent = this.history.slice(-5); // Last 5 samples
        
        if (recent.length < 2) {
            return {
                trend: 'insufficient_data',
                growthRate: 0,
                timeToLimit: Infinity
            };
        }
        
        // Calculate growth rate
        const first = recent[0];
        const last = recent[recent.length - 1];
        const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds
        const heapGrowth = last.heap.used - first.heap.used;
        const growthRate = heapGrowth / timeDiff; // bytes per second
        
        // Calculate trend
        let trend = 'stable';
        if (growthRate > 1024 * 1024) { // 1MB/s growth
            trend = 'increasing_fast';
        } else if (growthRate > 512 * 1024) { // 512KB/s growth
            trend = 'increasing';
        } else if (growthRate < -512 * 1024) { // 512KB/s decrease
            trend = 'decreasing';
        }
        
        // Calculate time to limit
        const remainingHeap = sample.heap.limit - sample.heap.used;
        const timeToLimit = growthRate > 0 ? remainingHeap / growthRate : Infinity;
        
        return {
            trend,
            growthRate: Math.round(growthRate / 1024), // KB/s
            timeToLimit: Math.round(timeToLimit / 60), // minutes
            heapEfficiency: sample.heap.used / sample.heap.total,
            gcEfficiency: this.calculateGCEfficiency()
        };
    }
    
    /**
     * Detect memory leaks using pattern analysis
     */
    detectMemoryLeaks() {
        if (this.history.length < this.config.leakDetectionWindow) {
            return;
        }
        
        const samples = this.history.slice(-this.config.leakDetectionWindow);
        
        // Check for consistent growth pattern
        let consistentGrowth = true;
        let totalGrowth = 0;
        let growthCount = 0;
        
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1];
            const curr = samples[i];
            
            const heapGrowth = (curr.heap.used - prev.heap.used) / prev.heap.used;
            const rssGrowth = (curr.process.rss - prev.process.rss) / prev.process.rss;
            
            if (heapGrowth > 0 || rssGrowth > 0) {
                totalGrowth += Math.max(heapGrowth, rssGrowth);
                growthCount++;
            } else {
                consistentGrowth = false;
            }
        }
        
        const avgGrowth = growthCount > 0 ? totalGrowth / growthCount : 0;
        
        // Check for leak indicators
        const leakIndicators = {
            consistentGrowth: consistentGrowth && avgGrowth > this.config.leakGrowthThreshold,
            lowGCEfficiency: this.calculateGCEfficiency() < this.config.gcEfficiencyThreshold,
            highExternalMemory: samples[samples.length - 1].process.external > this.externalThreshold
        };
        
        const leakScore = Object.values(leakIndicators).filter(Boolean).length;
        
        if (leakScore >= 2) {
            this.stats.leakDetectionCount++;
            
            const firstSample = samples[0];
            const lastSample = samples[samples.length - 1];
            const totalIncrease = lastSample.heap.used - firstSample.heap.used;
            
            this.emit('memory:leak-detected', {
                confidence: leakScore / 3,
                indicators: leakIndicators,
                avgGrowthPercent: Math.round(avgGrowth * 100),
                totalIncreaseMB: Math.round(totalIncrease / 1024 / 1024),
                windowMinutes: Math.round((this.config.leakDetectionWindow * this.config.checkInterval) / 60000),
                currentHeapMB: lastSample.heap.usedMB,
                recommendation: 'Memory leak detected - investigate growing data structures'
            });
        }
    }
    
    /**
     * Check for emergency conditions requiring immediate action
     */
    checkEmergencyConditions() {
        const latest = this.getLatestSample();
        if (!latest) return;
        
        const emergencyConditions = {
            heapCritical: latest.heap.usagePercent >= this.thresholds.emergency,
            rssOverLimit: latest.process.rss > this.rssThreshold,
            externalOverLimit: latest.process.external > this.externalThreshold,
            systemMemoryLow: latest.system.usagePercent > 0.95,
            heapFragmentation: this.detectHeapFragmentation(latest)
        };
        
        const emergencyCount = Object.values(emergencyConditions).filter(Boolean).length;
        
        if (emergencyCount >= 2) {
            this.stats.emergencyActionsCount++;
            
            this.emit('memory:emergency-action-needed', {
                conditions: emergencyConditions,
                emergencyCount,
                sample: latest,
                recommendation: 'Emergency memory management required - consider component shutdown'
            });
        }
    }
    
    /**
     * Detect heap fragmentation
     */
    detectHeapFragmentation(sample) {
        const fragmentation = 1 - (sample.heap.used / sample.heap.total);
        return fragmentation > 0.3 && sample.heap.usagePercent > 0.7;
    }
    
    /**
     * Calculate GC efficiency
     */
    calculateGCEfficiency() {
        if (this.history.length < 2) return 1;
        
        const recent = this.history.slice(-10);
        let totalFreed = 0;
        let totalBefore = 0;
        
        for (let i = 1; i < recent.length; i++) {
            const prev = recent[i - 1];
            const curr = recent[i];
            
            if (curr.gc.count > prev.gc.count) {
                // GC happened
                const freed = prev.heap.used - curr.heap.used;
                if (freed > 0) {
                    totalFreed += freed;
                    totalBefore += prev.heap.used;
                }
            }
        }
        
        return totalBefore > 0 ? totalFreed / totalBefore : 0;
    }
    
    /**
     * Register component memory tracking
     */
    registerComponent(name, sizeGetter) {
        this.componentSizeGetters.set(name, sizeGetter);
        this.emit('component:registered', { name });
    }
    
    /**
     * Unregister component memory tracking
     */
    unregisterComponent(name) {
        this.componentSizeGetters.delete(name);
        this.emit('component:unregistered', { name });
    }
    
    /**
     * Setup GC tracking if available
     */
    setupGCTracking() {
        const originalGC = global.gc;
        global.gc = (...args) => {
            this.stats.gcCount++;
            this.stats.lastGCTime = Date.now();
            
            const before = process.memoryUsage();
            const result = originalGC.apply(this, args);
            const after = process.memoryUsage();
            
            this.emit('gc:executed', {
                before,
                after,
                freed: before.heapUsed - after.heapUsed,
                timestamp: this.stats.lastGCTime
            });
            
            return result;
        };
    }
    
    /**
     * Get latest sample
     */
    getLatestSample() {
        return this.history[this.history.length - 1];
    }
    
    /**
     * Get pressure statistics
     */
    getPressureStats() {
        const latest = this.getLatestSample();
        const uptime = Date.now() - this.stats.startTime;
        
        return {
            current: {
                level: this.currentPressureLevel,
                heapUsagePercent: latest ? Math.round(latest.heap.usagePercent * 100) : 0,
                heapUsedMB: latest ? latest.heap.usedMB : 0,
                rssMB: latest ? latest.process.rssMB : 0,
                externalMB: latest ? latest.process.externalMB : 0
            },
            thresholds: {
                warning: Math.round(this.thresholds.warning * 100),
                critical: Math.round(this.thresholds.critical * 100),
                emergency: Math.round(this.thresholds.emergency * 100)
            },
            stats: {
                uptime: Math.round(uptime / 1000),
                totalSamples: this.stats.totalSamples,
                pressureEvents: this.stats.pressureEvents,
                leakDetections: this.stats.leakDetectionCount,
                emergencyActions: this.stats.emergencyActionsCount,
                gcCount: this.stats.gcCount
            },
            components: Object.fromEntries(this.componentSizeGetters.keys().map(name => [name, 'tracked'])),
            isMonitoring: this.isMonitoring
        };
    }
    
    /**
     * Get pressure history
     */
    getPressureHistory() {
        return this.pressureHistory.slice();
    }
    
    /**
     * Get memory history
     */
    getMemoryHistory() {
        return this.history.map(sample => ({
            timestamp: sample.timestamp,
            heapUsagePercent: Math.round(sample.heap.usagePercent * 100),
            heapUsedMB: sample.heap.usedMB,
            rssMB: sample.process.rssMB,
            externalMB: sample.process.externalMB
        }));
    }
    
    /**
     * Force garbage collection and return results
     */
    forceGC() {
        if (!global.gc) {
            return { success: false, reason: 'GC not available' };
        }
        
        const before = process.memoryUsage();
        global.gc();
        const after = process.memoryUsage();
        
        const freed = before.heapUsed - after.heapUsed;
        const result = {
            success: true,
            freed: Math.round(freed / 1024 / 1024),
            beforeMB: Math.round(before.heapUsed / 1024 / 1024),
            afterMB: Math.round(after.heapUsed / 1024 / 1024),
            timestamp: Date.now()
        };
        
        this.emit('gc:forced', result);
        return result;
    }
}

export default MemoryPressureMonitor;