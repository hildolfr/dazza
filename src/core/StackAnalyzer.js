import { EventEmitter } from 'events';

/**
 * Stack Analyzer - Advanced call stack analysis and pattern recognition
 * 
 * Provides sophisticated analysis of function call stacks:
 * 1. Stack frame parsing and analysis
 * 2. Function signature extraction
 * 3. Call pattern recognition
 * 4. Performance profiling
 * 5. Memory correlation analysis
 * 6. Hot path detection
 */
class StackAnalyzer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            // Analysis settings
            maxStackDepthAnalysis: 100,    // Maximum stack depth to analyze
            minPatternLength: 2,           // Minimum pattern length
            maxPatternLength: 20,          // Maximum pattern length
            
            // Pattern detection thresholds
            hotPathThreshold: 10,          // Threshold for hot path detection
            performanceThreshold: 50,      // Performance threshold in ms
            memoryThreshold: 1024 * 1024,  // Memory threshold for correlation
            
            // Cache settings
            cacheSize: 1000,               // Pattern cache size
            cacheTimeout: 300000,          // Cache timeout (5 minutes)
            
            // Performance settings
            enablePerformanceAnalysis: true,
            enableMemoryAnalysis: true,
            enableHotPathDetection: true,
            
            // Sampling settings
            enableSampling: false,         // Enable sampling for performance
            samplingRate: 0.1,             // Sample 10% of stacks
            
            // Debug settings
            enableDebugLogging: false,
            enablePatternLogging: false,
            
            ...config
        };
        
        // Analysis cache
        this.cache = {
            patterns: new Map(),           // pattern hash -> analysis result
            signatures: new Map(),         // signature -> analysis data
            hotPaths: new Map(),           // path -> frequency
            performance: new Map(),        // function -> performance data
            
            // Cache metadata
            cacheHits: 0,
            cacheMisses: 0,
            lastCleanup: Date.now()
        };
        
        // Pattern recognition data
        this.patterns = {
            // Function call patterns
            functionPatterns: new Map(),   // pattern -> count
            callSequences: new Map(),      // sequence -> frequency
            recursivePatterns: new Map(),  // pattern -> recursion info
            
            // Performance patterns
            slowPaths: new Map(),          // path -> timing data
            fastPaths: new Map(),          // path -> timing data
            hotSpots: new Map(),           // function -> call count
            
            // Memory patterns
            memoryIntensive: new Map(),    // function -> memory usage
            memoryLeaks: new Map(),        // pattern -> leak info
            
            // Temporal patterns
            timePatterns: new Map(),       // time bucket -> patterns
            frequencyPatterns: new Map()   // frequency -> patterns
        };
        
        // Analysis algorithms - will be initialized after methods are defined
        this.algorithms = {};
        
        // Statistics
        this.stats = {
            totalAnalyses: 0,
            patternMatches: 0,
            performanceAnalyses: 0,
            memoryAnalyses: 0,
            hotPathDetections: 0,
            cacheUtilization: 0,
            startTime: Date.now()
        };
        
        // Initialize cleanup
        this.initializeCleanup();
    }
    
    // ===== Core Analysis Methods =====
    
    /**
     * Analyze stack pattern
     */
    analyzePattern(stackTrace) {
        this.stats.totalAnalyses++;
        
        if (!stackTrace) {
            return { isValid: false, reason: 'No stack trace provided' };
        }
        
        // Check sampling
        if (this.config.enableSampling && Math.random() > this.config.samplingRate) {
            return { isValid: false, reason: 'Sampled out' };
        }
        
        try {
            // Parse stack trace
            const stackFrames = this.parseStackTrace(stackTrace);
            
            if (stackFrames.length === 0) {
                return { isValid: false, reason: 'No stack frames found' };
            }
            
            // Generate signature
            const signature = this.generateSignature(stackFrames);
            
            // Check cache
            const cachedResult = this.getCachedAnalysis(signature);
            if (cachedResult) {
                this.cache.cacheHits++;
                return cachedResult;
            }
            
            // Perform full analysis
            const analysis = this.performFullAnalysis(stackFrames, signature);
            
            // Cache result
            this.cacheAnalysis(signature, analysis);
            this.cache.cacheMisses++;
            
            return analysis;
            
        } catch (error) {
            this.handleAnalysisError(error);
            return { isValid: false, reason: error.message };
        }
    }
    
    /**
     * Parse stack trace into structured frames
     */
    parseStackTrace(stackTrace) {
        const lines = stackTrace.split('\n');
        const frames = [];
        
        for (const line of lines) {
            const frame = this.parseStackFrame(line);
            if (frame) {
                frames.push(frame);
            }
        }
        
        return frames.slice(0, this.config.maxStackDepthAnalysis);
    }
    
    /**
     * Parse individual stack frame
     */
    parseStackFrame(line) {
        // Match different stack frame formats
        const patterns = [
            // Standard format: "at functionName (file:line:column)"
            /at\s+([^(]+)\s*\(([^)]+)\)/,
            // Anonymous format: "at file:line:column"
            /at\s+([^(]+):(\d+):(\d+)/,
            // Module format: "at Module.functionName (file:line:column)"
            /at\s+Module\.([^(]+)\s*\(([^)]+)\)/,
            // Object method format: "at Object.method (file:line:column)"
            /at\s+Object\.([^(]+)\s*\(([^)]+)\)/
        ];
        
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                return this.extractFrameInfo(match, line);
            }
        }
        
        return null;
    }
    
    /**
     * Extract frame information from regex match
     */
    extractFrameInfo(match, originalLine) {
        let functionName, location, file, lineNum, column;
        
        if (match.length >= 3) {
            functionName = match[1].trim();
            location = match[2];
            
            // Parse location
            const locationMatch = location.match(/([^:]+):(\d+):(\d+)/);
            if (locationMatch) {
                file = locationMatch[1];
                lineNum = parseInt(locationMatch[2]);
                column = parseInt(locationMatch[3]);
            }
        }
        
        // Clean up function name
        functionName = this.cleanFunctionName(functionName);
        
        return {
            functionName,
            file,
            line: lineNum,
            column,
            location,
            originalLine,
            
            // Derived properties
            isAnonymous: !functionName || functionName === '&lt;anonymous&gt;',
            isNative: file && file.includes('native'),
            isNodeModules: file && file.includes('node_modules'),
            isUserCode: file && !file.includes('node_modules') && !file.includes('native')
        };
    }
    
    /**
     * Clean function name
     */
    cleanFunctionName(name) {
        if (!name) return '&lt;anonymous&gt;';
        
        // Remove common prefixes
        name = name.replace(/^Object\./, '');
        name = name.replace(/^Module\./, '');
        name = name.replace(/^exports\./, '');
        
        // Handle async functions
        if (name.includes('async ')) {
            name = name.replace('async ', '') + ' (async)';
        }
        
        // Trim whitespace
        return name.trim();
    }
    
    /**
     * Generate signature for caching
     */
    generateSignature(stackFrames) {
        const functionNames = stackFrames.map(frame => frame.functionName);
        const userCodeFrames = stackFrames.filter(frame => frame.isUserCode);
        
        return {
            full: this.hashPattern(functionNames),
            userCode: this.hashPattern(userCodeFrames.map(f => f.functionName)),
            depth: stackFrames.length,
            userCodeDepth: userCodeFrames.length,
            topFunction: functionNames[0],
            bottomFunction: functionNames[functionNames.length - 1]
        };
    }
    
    /**
     * Hash pattern for signature
     */
    hashPattern(pattern) {
        const str = Array.isArray(pattern) ? pattern.join('->') : pattern;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    
    /**
     * Perform full stack analysis
     */
    performFullAnalysis(stackFrames, signature) {
        const analysis = {
            isValid: true,
            signature: signature.full,
            depth: stackFrames.length,
            userCodeDepth: signature.userCodeDepth,
            timestamp: Date.now(),
            
            // Basic info
            topFunction: signature.topFunction,
            bottomFunction: signature.bottomFunction,
            functions: stackFrames.map(f => f.functionName),
            
            // Pattern analysis
            patterns: [],
            isRecursive: false,
            recursionDepth: 0,
            
            // Performance analysis
            performance: null,
            hotPaths: [],
            
            // Memory analysis
            memory: null,
            
            // Classification
            type: 'normal',
            confidence: 1.0
        };
        
        // Pattern recognition
        this.analyzePatterns(stackFrames, analysis);
        
        // Performance analysis
        if (this.config.enablePerformanceAnalysis) {
            this.analyzeStackPerformance(stackFrames, analysis);
        }
        
        // Memory analysis
        if (this.config.enableMemoryAnalysis) {
            this.analyzeStackMemory(stackFrames, analysis);
        }
        
        // Hot path detection
        if (this.config.enableHotPathDetection) {
            this.analyzeStackHotPaths(stackFrames, analysis);
        }
        
        // Update statistics
        this.updateAnalysisStats(analysis);
        
        return analysis;
    }
    
    // ===== Pattern Analysis =====
    
    /**
     * Analyze patterns in stack frames
     */
    analyzePatterns(stackFrames, analysis) {
        const functionNames = stackFrames.map(f => f.functionName);
        
        // Direct recursion detection
        const directRecursion = this.detectDirectRecursion(functionNames);
        if (directRecursion.detected) {
            analysis.isRecursive = true;
            analysis.recursionDepth = directRecursion.depth;
            analysis.patterns.push(directRecursion);
            analysis.type = 'recursive';
        }
        
        // Pattern matching
        const patterns = this.findRepeatingPatterns(functionNames);
        analysis.patterns.push(...patterns);
        
        // Call sequence analysis
        const sequences = this.analyzeCallSequences(functionNames);
        analysis.patterns.push(...sequences);
        
        // Update pattern tracking
        this.updatePatternTracking(functionNames, patterns);
    }
    
    /**
     * Detect direct recursion
     */
    detectDirectRecursion(functionNames) {
        const functionCounts = new Map();
        let maxCount = 0;
        let recursiveFunction = null;
        
        for (const name of functionNames) {
            const count = (functionCounts.get(name) || 0) + 1;
            functionCounts.set(name, count);
            
            if (count > maxCount) {
                maxCount = count;
                recursiveFunction = name;
            }
        }
        
        return {
            detected: maxCount > 2,
            depth: maxCount,
            function: recursiveFunction,
            type: 'direct_recursion'
        };
    }
    
    /**
     * Find repeating patterns
     */
    findRepeatingPatterns(functionNames) {
        const patterns = [];
        
        for (let length = this.config.minPatternLength; length <= this.config.maxPatternLength; length++) {
            const pattern = this.findPatternOfLength(functionNames, length);
            if (pattern) {
                patterns.push(pattern);
            }
        }
        
        return patterns;
    }
    
    /**
     * Find pattern of specific length
     */
    findPatternOfLength(functionNames, length) {
        if (functionNames.length < length * 2) return null;
        
        const patternCounts = new Map();
        
        for (let i = 0; i <= functionNames.length - length; i++) {
            const pattern = functionNames.slice(i, i + length);
            const key = pattern.join('-&gt;');
            patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
        }
        
        // Find most frequent pattern
        let maxCount = 0;
        let bestPattern = null;
        
        for (const [pattern, count] of patternCounts) {
            if (count >= 2 && count > maxCount) {
                maxCount = count;
                bestPattern = pattern.split('-&gt;');
            }
        }
        
        if (bestPattern) {
            return {
                pattern: bestPattern,
                repetitions: maxCount,
                length,
                type: 'repeating_pattern'
            };
        }
        
        return null;
    }
    
    /**
     * Analyze call sequences
     */
    analyzeCallSequences(functionNames) {
        const sequences = [];
        
        // Look for common call sequences
        for (let i = 0; i < functionNames.length - 1; i++) {
            const caller = functionNames[i];
            const callee = functionNames[i + 1];
            const sequence = `${caller}-&gt;${callee}`;
            
            // Track sequence frequency
            const count = this.patterns.callSequences.get(sequence) || 0;
            this.patterns.callSequences.set(sequence, count + 1);
            
            // Detect hot sequences
            if (count > this.config.hotPathThreshold) {
                sequences.push({
                    caller,
                    callee,
                    sequence,
                    frequency: count,
                    type: 'hot_sequence'
                });
            }
        }
        
        return sequences;
    }
    
    /**
     * Update pattern tracking
     */
    updatePatternTracking(functionNames, patterns) {
        // Track function patterns
        for (const pattern of patterns) {
            if (pattern.pattern) {
                const key = pattern.pattern.join('-&gt;');
                const count = this.patterns.functionPatterns.get(key) || 0;
                this.patterns.functionPatterns.set(key, count + 1);
            }
        }
        
        // Track hot spots
        for (const functionName of functionNames) {
            const count = this.patterns.hotSpots.get(functionName) || 0;
            this.patterns.hotSpots.set(functionName, count + 1);
        }
    }
    
    // ===== Performance Analysis =====
    
    /**
     * Analyze stack performance
     */
    analyzeStackPerformance(stackFrames, analysis) {
        const performance = {
            slowFunctions: [],
            fastFunctions: [],
            bottlenecks: [],
            totalTime: 0,
            avgTimePerFrame: 0
        };
        
        // Analyze function performance
        for (const frame of stackFrames) {
            const perfData = this.cache.performance.get(frame.functionName);
            if (perfData) {
                performance.totalTime += perfData.avgTime;
                
                if (perfData.avgTime > this.config.performanceThreshold) {
                    performance.slowFunctions.push({
                        function: frame.functionName,
                        avgTime: perfData.avgTime,
                        callCount: perfData.callCount
                    });
                }
            }
        }
        
        performance.avgTimePerFrame = performance.totalTime / stackFrames.length;
        
        // Detect bottlenecks
        performance.bottlenecks = this.detectBottlenecks(stackFrames);
        
        analysis.performance = performance;
        this.stats.performanceAnalyses++;
    }
    
    /**
     * Detect bottlenecks in stack
     */
    detectBottlenecks(stackFrames) {
        const bottlenecks = [];
        
        // Look for functions that appear frequently in slow paths
        for (const frame of stackFrames) {
            const slowPathData = this.patterns.slowPaths.get(frame.functionName);
            if (slowPathData && slowPathData.frequency > 5) {
                bottlenecks.push({
                    function: frame.functionName,
                    slowPathFrequency: slowPathData.frequency,
                    avgSlowTime: slowPathData.avgTime
                });
            }
        }
        
        return bottlenecks;
    }
    
    /**
     * Analyze performance data
     */
    analyzePerformance(stackFrames, timing) {
        if (!timing) return;
        
        const timePerFrame = timing / stackFrames.length;
        
        for (const frame of stackFrames) {
            const functionName = frame.functionName;
            const perfData = this.cache.performance.get(functionName) || {
                callCount: 0,
                totalTime: 0,
                avgTime: 0,
                minTime: Infinity,
                maxTime: 0
            };
            
            perfData.callCount++;
            perfData.totalTime += timePerFrame;
            perfData.avgTime = perfData.totalTime / perfData.callCount;
            perfData.minTime = Math.min(perfData.minTime, timePerFrame);
            perfData.maxTime = Math.max(perfData.maxTime, timePerFrame);
            
            this.cache.performance.set(functionName, perfData);
        }
    }
    
    // ===== Hot Path Analysis =====
    
    /**
     * Analyze stack hot paths
     */
    analyzeStackHotPaths(stackFrames, analysis) {
        const hotPaths = [];
        
        // Generate path signatures
        for (let length = 2; length <= Math.min(5, stackFrames.length); length++) {
            for (let i = 0; i <= stackFrames.length - length; i++) {
                const path = stackFrames.slice(i, i + length).map(f => f.functionName);
                const pathKey = path.join('-&gt;');
                
                const frequency = this.cache.hotPaths.get(pathKey) || 0;
                this.cache.hotPaths.set(pathKey, frequency + 1);
                
                if (frequency >= this.config.hotPathThreshold) {
                    hotPaths.push({
                        path,
                        frequency: frequency + 1,
                        length,
                        type: 'hot_path'
                    });
                }
            }
        }
        
        analysis.hotPaths = hotPaths;
        
        if (hotPaths.length > 0) {
            this.stats.hotPathDetections++;
        }
    }
    
    /**
     * Analyze hot paths
     */
    analyzeHotPaths(stackFrames) {
        // Update hot path tracking
        this.analyzeStackHotPaths(stackFrames, { hotPaths: [] });
    }
    
    // ===== Memory Analysis =====
    
    /**
     * Analyze stack memory
     */
    analyzeStackMemory(stackFrames, analysis) {
        const memory = {
            intensiveFunctions: [],
            potentialLeaks: [],
            totalMemoryImpact: 0
        };
        
        // Analyze memory usage by function
        for (const frame of stackFrames) {
            const memData = this.patterns.memoryIntensive.get(frame.functionName);
            if (memData) {
                memory.totalMemoryImpact += memData.avgMemory;
                
                if (memData.avgMemory > this.config.memoryThreshold) {
                    memory.intensiveFunctions.push({
                        function: frame.functionName,
                        avgMemory: memData.avgMemory,
                        callCount: memData.callCount
                    });
                }
            }
        }
        
        // Detect potential leaks
        memory.potentialLeaks = this.detectPotentialLeaks(stackFrames);
        
        analysis.memory = memory;
        this.stats.memoryAnalyses++;
    }
    
    /**
     * Detect potential memory leaks
     */
    detectPotentialLeaks(stackFrames) {
        const potentialLeaks = [];
        
        for (const frame of stackFrames) {
            const leakData = this.patterns.memoryLeaks.get(frame.functionName);
            if (leakData && leakData.suspicionLevel > 0.7) {
                potentialLeaks.push({
                    function: frame.functionName,
                    suspicionLevel: leakData.suspicionLevel,
                    memoryGrowth: leakData.memoryGrowth
                });
            }
        }
        
        return potentialLeaks;
    }
    
    /**
     * Analyze memory usage
     */
    analyzeMemoryUsage(stackFrames, memoryDelta) {
        if (!memoryDelta) return;
        
        const memoryPerFrame = memoryDelta / stackFrames.length;
        
        for (const frame of stackFrames) {
            const functionName = frame.functionName;
            const memData = this.patterns.memoryIntensive.get(functionName) || {
                callCount: 0,
                totalMemory: 0,
                avgMemory: 0
            };
            
            memData.callCount++;
            memData.totalMemory += memoryPerFrame;
            memData.avgMemory = memData.totalMemory / memData.callCount;
            
            this.patterns.memoryIntensive.set(functionName, memData);
        }
    }
    
    /**
     * Detect memory leaks
     */
    detectMemoryLeaks(stackFrames, memoryGrowth) {
        if (!memoryGrowth || memoryGrowth <= 0) return;
        
        for (const frame of stackFrames) {
            const functionName = frame.functionName;
            const leakData = this.patterns.memoryLeaks.get(functionName) || {
                callCount: 0,
                totalGrowth: 0,
                avgGrowth: 0,
                suspicionLevel: 0
            };
            
            leakData.callCount++;
            leakData.totalGrowth += memoryGrowth;
            leakData.avgGrowth = leakData.totalGrowth / leakData.callCount;
            
            // Calculate suspicion level
            leakData.suspicionLevel = Math.min(
                leakData.avgGrowth / this.config.memoryThreshold,
                1.0
            );
            
            this.patterns.memoryLeaks.set(functionName, leakData);
        }
    }
    
    // ===== Pattern Matching Algorithms =====
    
    /**
     * Exact pattern matching
     */
    exactPatternMatch(pattern1, pattern2) {
        if (pattern1.length !== pattern2.length) return false;
        return pattern1.every((val, index) => val === pattern2[index]);
    }
    
    /**
     * Fuzzy pattern matching
     */
    fuzzyPatternMatch(pattern1, pattern2, threshold = 0.8) {
        const maxLength = Math.max(pattern1.length, pattern2.length);
        let matches = 0;
        
        for (let i = 0; i < maxLength; i++) {
            if (pattern1[i] === pattern2[i]) {
                matches++;
            }
        }
        
        return (matches / maxLength) >= threshold;
    }
    
    /**
     * Subsequence pattern matching
     */
    subsequencePatternMatch(pattern, sequence) {
        let patternIndex = 0;
        
        for (const item of sequence) {
            if (item === pattern[patternIndex]) {
                patternIndex++;
                if (patternIndex === pattern.length) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // ===== Caching =====
    
    /**
     * Get cached analysis
     */
    getCachedAnalysis(signature) {
        const cached = this.cache.patterns.get(signature.full);
        if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
            return cached;
        }
        return null;
    }
    
    /**
     * Cache analysis result
     */
    cacheAnalysis(signature, analysis) {
        // Limit cache size
        if (this.cache.patterns.size >= this.config.cacheSize) {
            this.cleanupCache();
        }
        
        this.cache.patterns.set(signature.full, analysis);
        this.cache.signatures.set(signature.full, signature);
    }
    
    /**
     * Cleanup cache
     */
    cleanupCache() {
        const now = Date.now();
        const cutoff = now - this.config.cacheTimeout;
        
        // Remove expired entries
        for (const [key, analysis] of this.cache.patterns) {
            if (analysis.timestamp < cutoff) {
                this.cache.patterns.delete(key);
                this.cache.signatures.delete(key);
            }
        }
        
        // If still too large, remove oldest entries
        if (this.cache.patterns.size > this.config.cacheSize * 0.8) {
            const entries = Array.from(this.cache.patterns.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toRemove = entries.slice(0, Math.floor(this.config.cacheSize * 0.2));
            for (const [key] of toRemove) {
                this.cache.patterns.delete(key);
                this.cache.signatures.delete(key);
            }
        }
        
        this.cache.lastCleanup = now;
    }
    
    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.patterns.clear();
        this.cache.signatures.clear();
        this.cache.hotPaths.clear();
        this.cache.performance.clear();
        
        this.patterns.functionPatterns.clear();
        this.patterns.callSequences.clear();
        this.patterns.recursivePatterns.clear();
        this.patterns.slowPaths.clear();
        this.patterns.fastPaths.clear();
        this.patterns.hotSpots.clear();
        this.patterns.memoryIntensive.clear();
        this.patterns.memoryLeaks.clear();
        this.patterns.timePatterns.clear();
        this.patterns.frequencyPatterns.clear();
    }
    
    // ===== Statistics and Monitoring =====
    
    /**
     * Update analysis statistics
     */
    updateAnalysisStats(analysis) {
        if (analysis.patterns.length > 0) {
            this.stats.patternMatches++;
        }
        
        // Update cache utilization
        this.stats.cacheUtilization = this.cache.cacheHits / 
            (this.cache.cacheHits + this.cache.cacheMisses);
    }
    
    /**
     * Get analysis statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            cache: {
                size: this.cache.patterns.size,
                maxSize: this.config.cacheSize,
                hits: this.cache.cacheHits,
                misses: this.cache.cacheMisses,
                hitRate: this.stats.cacheUtilization
            },
            patterns: {
                functionPatterns: this.patterns.functionPatterns.size,
                callSequences: this.patterns.callSequences.size,
                hotSpots: this.patterns.hotSpots.size,
                memoryIntensive: this.patterns.memoryIntensive.size
            }
        };
    }
    
    /**
     * Get hot paths
     */
    getHotPaths() {
        return Array.from(this.cache.hotPaths.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
    }
    
    /**
     * Get performance data
     */
    getPerformanceData() {
        return Array.from(this.cache.performance.entries())
            .sort((a, b) => b[1].avgTime - a[1].avgTime)
            .slice(0, 20);
    }
    
    // ===== Initialization and Cleanup =====
    
    /**
     * Initialize cleanup interval
     */
    initializeCleanup() {
        setInterval(() => {
            this.performPeriodicCleanup();
        }, 60000); // Every minute
    }
    
    /**
     * Perform periodic cleanup
     */
    performPeriodicCleanup() {
        const now = Date.now();
        
        // Cleanup cache if needed
        if (now - this.cache.lastCleanup > this.config.cacheTimeout) {
            this.cleanupCache();
        }
        
        // Cleanup old pattern data
        this.cleanupOldPatterns();
    }
    
    /**
     * Cleanup old pattern data
     */
    cleanupOldPatterns() {
        // This could be implemented to remove old pattern data
        // based on timestamp or usage frequency
    }
    
    /**
     * Handle analysis errors
     */
    handleAnalysisError(error) {
        this.debugLog(`Analysis error: ${error.message}`);
        this.emit('analysis:error', {
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }
    
    // ===== Public API =====
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.debugLog('Configuration updated');
        this.emit('config:updated', this.config);
    }
    
    /**
     * Debug logging
     */
    debugLog(message) {
        if (this.config.enableDebugLogging) {
            console.log(`[StackAnalyzer] ${message}`);
        }
    }
    
    /**
     * Shutdown analyzer
     */
    async shutdown() {
        this.debugLog('Shutting down stack analyzer');
        
        // Clear all data
        this.clearCache();
        
        // Remove all listeners
        this.removeAllListeners();
        
        this.debugLog('Stack analyzer shutdown complete');
    }
}

export default StackAnalyzer;