import { EventEmitter } from 'events';
import v8 from 'v8';
import os from 'os';

export class MemoryMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.warningThreshold = options.warningThreshold || 0.85; // 85% of heap limit
        this.criticalThreshold = options.criticalThreshold || 0.95; // 95% of heap limit
        this.checkInterval = options.checkInterval || 60000; // Check every minute
        this.historySize = options.historySize || 60; // Keep 60 samples (1 hour at 1 min intervals)
        
        // State tracking
        this.history = [];
        this.dataStructureSizes = new Map();
        this.lastGCTime = Date.now();
        this.gcCount = 0;
        this.startTime = Date.now();
        this.lastWarningTime = 0;
        this.warningCooldown = 300000; // 5 minutes between warnings
        
        // Memory leak detection
        this.leakDetectionWindow = options.leakDetectionWindow || 10; // samples to check
        this.leakGrowthThreshold = options.leakGrowthThreshold || 0.05; // 5% growth per sample
        
        // Monitoring interval
        this.monitorInterval = null;
        
        // Track if GC happened
        if (global.gc) {
            this.setupGCTracking();
        }
    }
    
    /**
     * Start memory monitoring
     */
    start() {
        if (this.monitorInterval) {
            return; // Already running
        }
        
        // Take initial sample
        this.sample();
        
        // Start periodic monitoring
        this.monitorInterval = setInterval(() => {
            this.sample();
            this.checkThresholds();
            this.detectLeaks();
        }, this.checkInterval);
        
        this.emit('started');
    }
    
    /**
     * Stop memory monitoring
     */
    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            this.emit('stopped');
        }
    }
    
    /**
     * Take a memory sample
     */
    sample() {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        const heapSpaces = v8.getHeapSpaceStatistics();
        
        const sample = {
            timestamp: Date.now(),
            process: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            heap: {
                totalHeapSize: heapStats.total_heap_size,
                totalHeapSizeExecutable: heapStats.total_heap_size_executable,
                totalPhysicalSize: heapStats.total_physical_size,
                totalAvailableSize: heapStats.total_available_size,
                usedHeapSize: heapStats.used_heap_size,
                heapSizeLimit: heapStats.heap_size_limit,
                mallocedMemory: heapStats.malloced_memory,
                peakMallocedMemory: heapStats.peak_malloced_memory,
                doesZapGarbage: heapStats.does_zap_garbage,
                numberOfNativeContexts: heapStats.number_of_native_contexts,
                numberOfDetachedContexts: heapStats.number_of_detached_contexts
            },
            heapSpaces: heapSpaces.map(space => ({
                spaceName: space.space_name,
                spaceSize: space.space_size,
                spaceUsedSize: space.space_used_size,
                spaceAvailableSize: space.space_available_size,
                physicalSpaceSize: space.physical_space_size
            })),
            system: {
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuUsage: process.cpuUsage()
            },
            dataStructures: Object.fromEntries(this.dataStructureSizes),
            gcInfo: {
                count: this.gcCount,
                lastGCTime: this.lastGCTime,
                timeSinceLastGC: Date.now() - this.lastGCTime
            }
        };
        
        // Calculate derived metrics
        sample.metrics = {
            heapUsagePercent: (sample.heap.usedHeapSize / sample.heap.heapSizeLimit) * 100,
            systemMemoryPercent: ((sample.system.totalMemory - sample.system.freeMemory) / sample.system.totalMemory) * 100,
            externalMemoryMB: Math.round(sample.process.external / 1024 / 1024),
            heapUsedMB: Math.round(sample.process.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(sample.process.heapTotal / 1024 / 1024),
            rssMB: Math.round(sample.process.rss / 1024 / 1024)
        };
        
        // Add to history
        this.history.push(sample);
        
        // Trim history to size limit
        if (this.history.length > this.historySize) {
            this.history.shift();
        }
        
        this.emit('sample', sample);
        
        return sample;
    }
    
    /**
     * Register a data structure to track its size
     */
    trackDataStructure(name, sizeGetter) {
        if (typeof sizeGetter === 'function') {
            // Function to get size
            this.dataStructureSizes.set(name, sizeGetter);
        } else if (sizeGetter instanceof Map || sizeGetter instanceof Set) {
            // Track Map/Set size
            this.dataStructureSizes.set(name, () => sizeGetter.size);
        } else if (Array.isArray(sizeGetter)) {
            // Track array length
            this.dataStructureSizes.set(name, () => sizeGetter.length);
        } else {
            // Direct size value
            this.dataStructureSizes.set(name, () => sizeGetter);
        }
    }
    
    /**
     * Unregister a tracked data structure
     */
    untrackDataStructure(name) {
        this.dataStructureSizes.delete(name);
    }
    
    /**
     * Check memory thresholds and emit warnings
     */
    checkThresholds() {
        const latest = this.getLatestSample();
        if (!latest) return;
        
        const heapPercent = latest.metrics.heapUsagePercent / 100;
        const now = Date.now();
        
        // Check if we should emit a warning
        const shouldWarn = now - this.lastWarningTime > this.warningCooldown;
        
        if (heapPercent > this.criticalThreshold && shouldWarn) {
            this.lastWarningTime = now;
            this.emit('critical', {
                heapPercent: Math.round(heapPercent * 100),
                heapUsedMB: latest.metrics.heapUsedMB,
                heapLimitMB: Math.round(latest.heap.heapSizeLimit / 1024 / 1024),
                suggestion: 'Consider restarting the bot to prevent out-of-memory crash'
            });
        } else if (heapPercent > this.warningThreshold && shouldWarn) {
            this.lastWarningTime = now;
            this.emit('warning', {
                heapPercent: Math.round(heapPercent * 100),
                heapUsedMB: latest.metrics.heapUsedMB,
                heapLimitMB: Math.round(latest.heap.heapSizeLimit / 1024 / 1024),
                suggestion: 'Memory usage is high, monitor closely'
            });
        }
    }
    
    /**
     * Detect potential memory leaks
     */
    detectLeaks() {
        if (this.history.length < this.leakDetectionWindow) {
            return; // Not enough data
        }
        
        // Get recent samples
        const recentSamples = this.history.slice(-this.leakDetectionWindow);
        
        // Check for consistent growth
        let consistentGrowth = true;
        let totalGrowth = 0;
        
        for (let i = 1; i < recentSamples.length; i++) {
            const prev = recentSamples[i - 1];
            const curr = recentSamples[i];
            
            const growth = (curr.heap.usedHeapSize - prev.heap.usedHeapSize) / prev.heap.usedHeapSize;
            
            if (growth <= 0) {
                consistentGrowth = false;
                break;
            }
            
            totalGrowth += growth;
        }
        
        const avgGrowth = totalGrowth / (recentSamples.length - 1);
        
        if (consistentGrowth && avgGrowth > this.leakGrowthThreshold) {
            const firstSample = recentSamples[0];
            const lastSample = recentSamples[recentSamples.length - 1];
            
            const totalIncrease = lastSample.heap.usedHeapSize - firstSample.heap.usedHeapSize;
            const totalIncreaseMB = Math.round(totalIncrease / 1024 / 1024);
            
            this.emit('leak-detected', {
                avgGrowthPercent: Math.round(avgGrowth * 100),
                totalIncreaseMB,
                windowSizeMinutes: Math.round((this.leakDetectionWindow * this.checkInterval) / 60000),
                heapUsedMB: lastSample.metrics.heapUsedMB,
                suggestion: 'Potential memory leak detected - memory consistently growing'
            });
        }
    }
    
    /**
     * Setup GC tracking if --expose-gc flag is used
     */
    setupGCTracking() {
        const originalGC = global.gc;
        global.gc = (...args) => {
            this.gcCount++;
            this.lastGCTime = Date.now();
            return originalGC.apply(this, args);
        };
    }
    
    /**
     * Get latest memory sample
     */
    getLatestSample() {
        return this.history[this.history.length - 1];
    }
    
    /**
     * Get memory statistics
     */
    getStats() {
        if (this.history.length === 0) {
            return null;
        }
        
        const latest = this.getLatestSample();
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        
        // Calculate averages
        const avgHeapUsed = this.history.reduce((sum, s) => sum + s.process.heapUsed, 0) / this.history.length;
        const avgRss = this.history.reduce((sum, s) => sum + s.process.rss, 0) / this.history.length;
        
        // Find peaks
        const peakHeapUsed = Math.max(...this.history.map(s => s.process.heapUsed));
        const peakRss = Math.max(...this.history.map(s => s.process.rss));
        
        // Memory trend (compare last 10 samples to previous 10)
        let trend = 'stable';
        if (this.history.length >= 20) {
            const recent = this.history.slice(-10);
            const previous = this.history.slice(-20, -10);
            
            const recentAvg = recent.reduce((sum, s) => sum + s.heap.usedHeapSize, 0) / recent.length;
            const previousAvg = previous.reduce((sum, s) => sum + s.heap.usedHeapSize, 0) / previous.length;
            
            const change = (recentAvg - previousAvg) / previousAvg;
            
            if (change > 0.1) trend = 'increasing';
            else if (change < -0.1) trend = 'decreasing';
        }
        
        return {
            current: {
                heapUsedMB: latest.metrics.heapUsedMB,
                heapTotalMB: latest.metrics.heapTotalMB,
                rssMB: latest.metrics.rssMB,
                externalMB: latest.metrics.externalMemoryMB,
                heapPercent: Math.round(latest.metrics.heapUsagePercent)
            },
            average: {
                heapUsedMB: Math.round(avgHeapUsed / 1024 / 1024),
                rssMB: Math.round(avgRss / 1024 / 1024)
            },
            peak: {
                heapUsedMB: Math.round(peakHeapUsed / 1024 / 1024),
                rssMB: Math.round(peakRss / 1024 / 1024)
            },
            gc: {
                count: this.gcCount,
                avgTimeBetweenGC: this.gcCount > 0 ? Math.round(uptime / this.gcCount) : 0,
                lastGC: this.lastGCTime ? new Date(this.lastGCTime).toISOString() : 'Never'
            },
            dataStructures: Object.fromEntries(
                Array.from(this.dataStructureSizes.entries()).map(([name, getter]) => {
                    try {
                        return [name, getter()];
                    } catch {
                        return [name, 'Error'];
                    }
                })
            ),
            trend,
            uptime,
            samples: this.history.length
        };
    }
    
    /**
     * Get memory history for charts
     */
    getHistory() {
        return this.history.map(sample => ({
            timestamp: sample.timestamp,
            heapUsedMB: sample.metrics.heapUsedMB,
            heapTotalMB: sample.metrics.heapTotalMB,
            rssMB: sample.metrics.rssMB,
            heapPercent: sample.metrics.heapUsagePercent
        }));
    }
    
    /**
     * Force garbage collection (if --expose-gc flag is used)
     */
    forceGC() {
        if (global.gc) {
            const before = process.memoryUsage().heapUsed;
            global.gc();
            const after = process.memoryUsage().heapUsed;
            const freed = before - after;
            
            this.emit('gc-forced', {
                freedMB: Math.round(freed / 1024 / 1024),
                beforeMB: Math.round(before / 1024 / 1024),
                afterMB: Math.round(after / 1024 / 1024)
            });
            
            return true;
        }
        return false;
    }
    
    /**
     * Get detailed heap space information
     */
    getHeapSpaceDetails() {
        const latest = this.getLatestSample();
        if (!latest) return null;
        
        return latest.heapSpaces.map(space => ({
            name: space.spaceName,
            usedMB: Math.round(space.spaceUsedSize / 1024 / 1024),
            totalMB: Math.round(space.spaceSize / 1024 / 1024),
            percent: Math.round((space.spaceUsedSize / space.spaceSize) * 100)
        }));
    }
}

export default MemoryMonitor;