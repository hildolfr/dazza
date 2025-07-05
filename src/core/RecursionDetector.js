import { EventEmitter } from 'events';

/**
 * Recursion Detector - Advanced pattern detection for recursive function calls
 * 
 * Provides sophisticated analysis of function call patterns to detect:
 * 1. Direct recursion (function calls itself)
 * 2. Indirect recursion (function calls through other functions)
 * 3. Mutual recursion (functions call each other)
 * 4. Deep recursion chains
 * 5. Infinite loops in async/callback patterns
 */
class RecursionDetector extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            // Pattern detection thresholds
            directRecursionThreshold: 5,      // Direct function calls
            indirectRecursionThreshold: 10,   // Indirect recursion depth
            mutualRecursionThreshold: 8,      // Mutual recursion cycles
            chainDepthThreshold: 15,          // Deep recursion chains
            
            // Time-based detection
            patternWindowMs: 1000,            // Pattern detection window
            callFrequencyThreshold: 20,       // Calls per second threshold
            
            // Memory and pattern analysis
            maxPatternHistory: 1000,          // Maximum patterns to track
            maxCallChainDepth: 50,            // Maximum call chain depth to analyze
            
            // Cache and performance
            cacheSize: 500,                   // Pattern signature cache size
            analysisTimeout: 100,             // Max analysis time in ms
            
            // Debug settings
            enableDebugLogging: false,
            enablePatternLogging: false,
            
            ...config
        };
        
        // Pattern detection state
        this.patterns = {
            // Function call tracking
            callStack: [],                    // Current call stack
            callHistory: [],                  // Historical call patterns
            functionCallCounts: new Map(),    // function -> call count
            
            // Recursion pattern tracking
            directRecursions: new Map(),      // function -> recursion info
            indirectRecursions: new Map(),    // pattern -> recursion info
            mutualRecursions: new Map(),      // cycle -> recursion info
            
            // Advanced pattern analysis
            callChains: new Map(),            // chain signature -> chain info
            loopPatterns: new Map(),          // loop signature -> loop info
            asyncPatterns: new Map(),         // async pattern -> info
            
            // Performance tracking
            patternCache: new Map(),          // signature -> cached analysis
            analysisMetrics: {
                totalAnalyses: 0,
                avgAnalysisTime: 0,
                cacheHits: 0,
                cacheMisses: 0
            }
        };
        
        // Detection algorithms
        this.algorithms = {
            // Direct recursion detection
            directRecursion: {
                enabled: true,
                threshold: this.config.directRecursionThreshold
            },
            
            // Indirect recursion detection
            indirectRecursion: {
                enabled: true,
                threshold: this.config.indirectRecursionThreshold,
                maxDepth: this.config.maxCallChainDepth
            },
            
            // Mutual recursion detection
            mutualRecursion: {
                enabled: true,
                threshold: this.config.mutualRecursionThreshold
            },
            
            // Pattern-based detection
            patternBased: {
                enabled: true,
                windowSize: this.config.patternWindowMs,
                frequencyThreshold: this.config.callFrequencyThreshold
            },
            
            // Memory correlation detection
            memoryCorrelation: {
                enabled: true,
                memoryThreshold: 10 * 1024 * 1024 // 10MB
            }
        };
        
        // Statistics
        this.stats = {
            totalDetections: 0,
            directRecursionDetections: 0,
            indirectRecursionDetections: 0,
            mutualRecursionDetections: 0,
            patternDetections: 0,
            falsePositives: 0,
            startTime: Date.now()
        };
        
        // Initialize cleanup
        this.initializeCleanup();
    }
    
    // ===== Core Detection Methods =====
    
    /**
     * Analyze stack trace for recursion patterns
     */
    analyzeStackTrace(stackTrace) {
        if (!stackTrace) return { isRecursive: false };
        
        const startTime = process.hrtime.bigint();
        
        try {
            // Parse stack trace into function calls
            const functionCalls = this.parseStackTrace(stackTrace);
            
            // Generate signature for caching
            const signature = this.generateSignature(functionCalls);
            
            // Check cache first
            const cachedResult = this.patterns.patternCache.get(signature);
            if (cachedResult) {
                this.patterns.analysisMetrics.cacheHits++;
                return cachedResult;
            }
            
            // Perform analysis
            const analysis = this.performFullAnalysis(functionCalls, signature);
            
            // Cache result
            this.cacheAnalysis(signature, analysis);
            
            // Update metrics
            this.updateAnalysisMetrics(startTime);
            
            return analysis;
            
        } catch (error) {
            this.handleAnalysisError(error);
            return { isRecursive: false, error: error.message };
        }
    }
    
    /**
     * Parse stack trace into function calls
     */
    parseStackTrace(stackTrace) {
        const lines = stackTrace.split('\n');
        const functionCalls = [];
        
        for (const line of lines) {
            const match = line.match(/at\s+([^(]+)\s*\(([^)]*)\)/);
            if (match) {
                const [, functionName, location] = match;
                
                // Clean up function name
                const cleanName = functionName.trim().replace(/^Object\./, '');
                
                // Extract file and line info
                const locationMatch = location.match(/([^:]+):(\d+):(\d+)/);
                const fileInfo = locationMatch ? {
                    file: locationMatch[1],
                    line: parseInt(locationMatch[2]),
                    column: parseInt(locationMatch[3])
                } : null;
                
                functionCalls.push({
                    name: cleanName,
                    location: fileInfo,
                    rawLine: line
                });
            }
        }
        
        return functionCalls;
    }
    
    /**
     * Generate signature for function call pattern
     */
    generateSignature(functionCalls) {
        // Create a signature based on function names and patterns
        const functionNames = functionCalls.map(call => call.name);
        const patternHash = this.hashPattern(functionNames);
        
        return {
            hash: patternHash,
            length: functionNames.length,
            functions: functionNames,
            firstFunction: functionNames[0],
            lastFunction: functionNames[functionNames.length - 1]
        };
    }
    
    /**
     * Perform full recursion analysis
     */
    performFullAnalysis(functionCalls, signature) {
        const analysis = {
            isRecursive: false,
            signature: signature.hash,
            depth: functionCalls.length,
            functions: functionCalls.map(call => call.name),
            recursionTypes: [],
            patterns: [],
            confidence: 0
        };
        
        // Direct recursion detection
        const directRecursion = this.detectDirectRecursion(functionCalls);
        if (directRecursion.detected) {
            analysis.isRecursive = true;
            analysis.recursionTypes.push('direct');
            analysis.patterns.push(directRecursion);
            analysis.confidence += 0.4;
        }
        
        // Indirect recursion detection
        const indirectRecursion = this.detectIndirectRecursion(functionCalls);
        if (indirectRecursion.detected) {
            analysis.isRecursive = true;
            analysis.recursionTypes.push('indirect');
            analysis.patterns.push(indirectRecursion);
            analysis.confidence += 0.3;
        }
        
        // Mutual recursion detection
        const mutualRecursion = this.detectMutualRecursion(functionCalls);
        if (mutualRecursion.detected) {
            analysis.isRecursive = true;
            analysis.recursionTypes.push('mutual');
            analysis.patterns.push(mutualRecursion);
            analysis.confidence += 0.35;
        }
        
        // Pattern-based detection
        const patternRecursion = this.detectPatternRecursion(functionCalls);
        if (patternRecursion.detected) {
            analysis.isRecursive = true;
            analysis.recursionTypes.push('pattern');
            analysis.patterns.push(patternRecursion);
            analysis.confidence += 0.25;
        }
        
        // Deep chain detection
        const deepChain = this.detectDeepChain(functionCalls);
        if (deepChain.detected) {
            analysis.isRecursive = true;
            analysis.recursionTypes.push('deep_chain');
            analysis.patterns.push(deepChain);
            analysis.confidence += 0.2;
        }
        
        // Normalize confidence
        analysis.confidence = Math.min(analysis.confidence, 1.0);
        
        // Update statistics
        if (analysis.isRecursive) {
            this.updateDetectionStats(analysis);
        }
        
        return analysis;
    }
    
    // ===== Recursion Detection Algorithms =====
    
    /**
     * Detect direct recursion (function calls itself)
     */
    detectDirectRecursion(functionCalls) {
        const functionCounts = new Map();
        
        // Count function occurrences
        for (const call of functionCalls) {
            const count = functionCounts.get(call.name) || 0;
            functionCounts.set(call.name, count + 1);
        }
        
        // Find functions with high occurrence counts
        const recursiveFunctions = [];
        for (const [functionName, count] of functionCounts) {
            if (count >= this.algorithms.directRecursion.threshold) {
                recursiveFunctions.push({
                    name: functionName,
                    count,
                    threshold: this.algorithms.directRecursion.threshold
                });
            }
        }
        
        return {
            detected: recursiveFunctions.length > 0,
            type: 'direct',
            functions: recursiveFunctions,
            confidence: Math.min(recursiveFunctions.length * 0.2, 1.0)
        };
    }
    
    /**
     * Detect indirect recursion (function calls through other functions)
     */
    detectIndirectRecursion(functionCalls) {
        const callChains = [];
        
        // Build call chains
        for (let i = 0; i < functionCalls.length - 1; i++) {
            const chain = [];
            const maxChainLength = Math.min(
                this.algorithms.indirectRecursion.maxDepth,
                functionCalls.length - i
            );
            
            for (let j = 0; j < maxChainLength; j++) {
                chain.push(functionCalls[i + j].name);
            }
            
            callChains.push(chain);
        }
        
        // Detect cycles in call chains
        const cycles = [];
        for (const chain of callChains) {
            const cycle = this.findCycleInChain(chain);
            if (cycle) {
                cycles.push(cycle);
            }
        }
        
        // Filter significant cycles
        const significantCycles = cycles.filter(cycle => 
            cycle.length >= 2 && cycle.repetitions >= 2
        );
        
        return {
            detected: significantCycles.length > 0,
            type: 'indirect',
            cycles: significantCycles,
            confidence: Math.min(significantCycles.length * 0.15, 1.0)
        };
    }
    
    /**
     * Detect mutual recursion (functions call each other)
     */
    detectMutualRecursion(functionCalls) {
        const callGraph = this.buildCallGraph(functionCalls);
        const mutualPairs = [];
        
        // Find mutual recursion pairs
        for (const [caller, callees] of callGraph) {
            for (const callee of callees) {
                // Check if callee also calls caller
                const calleeTargets = callGraph.get(callee) || new Set();
                if (calleeTargets.has(caller)) {
                    mutualPairs.push({
                        functions: [caller, callee],
                        callCount: Math.min(callees.get(callee) || 0, calleeTargets.get(caller) || 0)
                    });
                }
            }
        }
        
        // Filter significant mutual recursions
        const significantMutual = mutualPairs.filter(pair => 
            pair.callCount >= this.algorithms.mutualRecursion.threshold
        );
        
        return {
            detected: significantMutual.length > 0,
            type: 'mutual',
            pairs: significantMutual,
            confidence: Math.min(significantMutual.length * 0.2, 1.0)
        };
    }
    
    /**
     * Detect pattern-based recursion
     */
    detectPatternRecursion(functionCalls) {
        const patterns = [];
        
        // Look for repeating patterns
        for (let patternLength = 2; patternLength <= 10; patternLength++) {
            const pattern = this.findRepeatingPattern(functionCalls, patternLength);
            if (pattern) {
                patterns.push(pattern);
            }
        }
        
        // Filter significant patterns
        const significantPatterns = patterns.filter(pattern => 
            pattern.repetitions >= 3 && pattern.confidence > 0.7
        );
        
        return {
            detected: significantPatterns.length > 0,
            type: 'pattern',
            patterns: significantPatterns,
            confidence: Math.min(significantPatterns.length * 0.1, 1.0)
        };
    }
    
    /**
     * Detect deep recursion chains
     */
    detectDeepChain(functionCalls) {
        const chainLength = functionCalls.length;
        const uniqueFunctions = new Set(functionCalls.map(call => call.name)).size;
        const repetitionRatio = chainLength / uniqueFunctions;
        
        // Detect if we have a deep chain with high repetition
        const isDeepChain = chainLength > this.config.chainDepthThreshold && 
                          repetitionRatio > 2.0;
        
        return {
            detected: isDeepChain,
            type: 'deep_chain',
            chainLength,
            uniqueFunctions,
            repetitionRatio,
            confidence: isDeepChain ? Math.min(repetitionRatio * 0.1, 1.0) : 0
        };
    }
    
    // ===== Helper Methods =====
    
    /**
     * Hash a pattern for caching
     */
    hashPattern(functionNames) {
        const joined = functionNames.join('->');
        let hash = 0;
        for (let i = 0; i < joined.length; i++) {
            const char = joined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    
    /**
     * Find cycle in call chain
     */
    findCycleInChain(chain) {
        for (let start = 0; start < chain.length; start++) {
            for (let length = 2; length <= Math.floor((chain.length - start) / 2); length++) {
                const pattern = chain.slice(start, start + length);
                const nextPattern = chain.slice(start + length, start + length * 2);
                
                if (this.arraysEqual(pattern, nextPattern)) {
                    // Found a cycle, count repetitions
                    let repetitions = 1;
                    let pos = start + length;
                    
                    while (pos + length <= chain.length) {
                        const testPattern = chain.slice(pos, pos + length);
                        if (this.arraysEqual(pattern, testPattern)) {
                            repetitions++;
                            pos += length;
                        } else {
                            break;
                        }
                    }
                    
                    return {
                        pattern,
                        start,
                        length,
                        repetitions,
                        totalLength: repetitions * length
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Build call graph from function calls
     */
    buildCallGraph(functionCalls) {
        const graph = new Map();
        
        for (let i = 0; i < functionCalls.length - 1; i++) {
            const caller = functionCalls[i].name;
            const callee = functionCalls[i + 1].name;
            
            if (!graph.has(caller)) {
                graph.set(caller, new Map());
            }
            
            const callees = graph.get(caller);
            const count = callees.get(callee) || 0;
            callees.set(callee, count + 1);
        }
        
        return graph;
    }
    
    /**
     * Find repeating pattern in function calls
     */
    findRepeatingPattern(functionCalls, patternLength) {
        const functionNames = functionCalls.map(call => call.name);
        
        if (functionNames.length < patternLength * 2) {
            return null;
        }
        
        const patternCounts = new Map();
        
        // Extract all possible patterns of given length
        for (let i = 0; i <= functionNames.length - patternLength; i++) {
            const pattern = functionNames.slice(i, i + patternLength);
            const patternKey = pattern.join('->');
            
            const count = patternCounts.get(patternKey) || 0;
            patternCounts.set(patternKey, count + 1);
        }
        
        // Find the most frequent pattern
        let maxCount = 0;
        let bestPattern = null;
        
        for (const [patternKey, count] of patternCounts) {
            if (count > maxCount) {
                maxCount = count;
                bestPattern = patternKey.split('->');
            }
        }
        
        if (maxCount >= 3) {
            return {
                pattern: bestPattern,
                repetitions: maxCount,
                length: patternLength,
                confidence: Math.min(maxCount * 0.1, 1.0)
            };
        }
        
        return null;
    }
    
    /**
     * Check if two arrays are equal
     */
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((val, index) => val === arr2[index]);
    }
    
    // ===== Caching and Performance =====
    
    /**
     * Cache analysis result
     */
    cacheAnalysis(signature, analysis) {
        // Limit cache size
        if (this.patterns.patternCache.size >= this.config.cacheSize) {
            // Remove oldest entries
            const entries = Array.from(this.patterns.patternCache.entries());
            const toRemove = entries.slice(0, Math.floor(this.config.cacheSize * 0.2));
            toRemove.forEach(([key]) => this.patterns.patternCache.delete(key));
        }
        
        this.patterns.patternCache.set(signature.hash, analysis);
        this.patterns.analysisMetrics.cacheMisses++;
    }
    
    /**
     * Update analysis metrics
     */
    updateAnalysisMetrics(startTime) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // Convert to ms
        
        this.patterns.analysisMetrics.totalAnalyses++;
        
        // Update average analysis time
        const total = this.patterns.analysisMetrics.totalAnalyses;
        const current = this.patterns.analysisMetrics.avgAnalysisTime;
        this.patterns.analysisMetrics.avgAnalysisTime = (current * (total - 1) + duration) / total;
    }
    
    /**
     * Update detection statistics
     */
    updateDetectionStats(analysis) {
        this.stats.totalDetections++;
        
        if (analysis.recursionTypes.includes('direct')) {
            this.stats.directRecursionDetections++;
        }
        if (analysis.recursionTypes.includes('indirect')) {
            this.stats.indirectRecursionDetections++;
        }
        if (analysis.recursionTypes.includes('mutual')) {
            this.stats.mutualRecursionDetections++;
        }
        if (analysis.recursionTypes.includes('pattern')) {
            this.stats.patternDetections++;
        }
        
        // Emit detection event
        this.emit('recursion:detected', analysis);
    }
    
    // ===== Cleanup and Maintenance =====
    
    /**
     * Initialize periodic cleanup
     */
    initializeCleanup() {
        setInterval(() => {
            this.performCleanup();
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Perform cleanup of old patterns and data
     */
    performCleanup() {
        const now = Date.now();
        const cleanupThreshold = this.config.patternWindowMs * 10; // 10x pattern window
        
        // Cleanup old call history
        this.patterns.callHistory = this.patterns.callHistory.filter(
            entry => now - entry.timestamp < cleanupThreshold
        );
        
        // Cleanup old pattern data
        for (const [key, data] of this.patterns.directRecursions) {
            if (now - data.timestamp > cleanupThreshold) {
                this.patterns.directRecursions.delete(key);
            }
        }
        
        for (const [key, data] of this.patterns.indirectRecursions) {
            if (now - data.timestamp > cleanupThreshold) {
                this.patterns.indirectRecursions.delete(key);
            }
        }
        
        for (const [key, data] of this.patterns.mutualRecursions) {
            if (now - data.timestamp > cleanupThreshold) {
                this.patterns.mutualRecursions.delete(key);
            }
        }
        
        // Cleanup pattern cache if it's too large
        if (this.patterns.patternCache.size > this.config.cacheSize * 1.5) {
            this.patterns.patternCache.clear();
        }
    }
    
    /**
     * Clear all caches
     */
    clearCache() {
        this.patterns.patternCache.clear();
        this.patterns.callHistory = [];
        this.patterns.directRecursions.clear();
        this.patterns.indirectRecursions.clear();
        this.patterns.mutualRecursions.clear();
        this.patterns.callChains.clear();
        this.patterns.loopPatterns.clear();
        this.patterns.asyncPatterns.clear();
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
     * Analyze pattern for recursion
     */
    analyzePattern(stackTrace) {
        return this.analyzeStackTrace(stackTrace);
    }
    
    /**
     * Get detection statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            analysisMetrics: this.patterns.analysisMetrics,
            cacheStats: {
                size: this.patterns.patternCache.size,
                maxSize: this.config.cacheSize,
                hitRate: this.patterns.analysisMetrics.cacheHits / 
                        (this.patterns.analysisMetrics.cacheHits + this.patterns.analysisMetrics.cacheMisses)
            }
        };
    }
    
    /**
     * Get current patterns
     */
    getPatterns() {
        return {
            directRecursions: Array.from(this.patterns.directRecursions.entries()),
            indirectRecursions: Array.from(this.patterns.indirectRecursions.entries()),
            mutualRecursions: Array.from(this.patterns.mutualRecursions.entries()),
            callChains: Array.from(this.patterns.callChains.entries()),
            loopPatterns: Array.from(this.patterns.loopPatterns.entries())
        };
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Update algorithm settings
        this.algorithms.directRecursion.threshold = this.config.directRecursionThreshold;
        this.algorithms.indirectRecursion.threshold = this.config.indirectRecursionThreshold;
        this.algorithms.mutualRecursion.threshold = this.config.mutualRecursionThreshold;
        
        this.debugLog('Configuration updated');
        this.emit('config:updated', this.config);
    }
    
    /**
     * Debug logging
     */
    debugLog(message) {
        if (this.config.enableDebugLogging) {
            console.log(`[RecursionDetector] ${message}`);
        }
    }
    
    /**
     * Shutdown detector
     */
    async shutdown() {
        this.debugLog('Shutting down recursion detector');
        
        // Clear all data
        this.clearCache();
        
        // Remove all listeners
        this.removeAllListeners();
        
        this.debugLog('Recursion detector shutdown complete');
    }
}

export default RecursionDetector;