import { EventEmitter } from 'events';

/**
 * Health Reporter - Health status reporting, alerting, and trend analysis
 * 
 * Provides:
 * 1. Comprehensive health report generation
 * 2. Multi-channel alerting system
 * 3. Trend analysis and pattern detection
 * 4. Predictive health analysis
 * 5. Alert management and escalation
 * 6. Health metrics visualization data
 */
export class HealthReporter extends EventEmitter {
    constructor(config, logger) {
        super();
        this.config = config;
        this.logger = logger;
        
        // Reporter configuration
        this.reporterConfig = {
            // Report generation settings
            reports: {
                includeHistory: true,
                includeMetrics: true,
                includePredictions: true,
                maxHistoryItems: 100,
                ...config.reports
            },
            
            // Alert configuration
            alerts: {
                enabled: config.alerts?.enabled ?? true,
                channels: config.alerts?.channels ?? ['log', 'event'],
                levels: ['info', 'warning', 'critical', 'emergency'],
                cooldown: config.alerts?.cooldown ?? 300000, // 5 minutes
                escalation: config.alerts?.escalation ?? true,
                ...config.alerts
            },
            
            // Trend analysis settings
            trends: {
                enabled: true,
                analysisWindow: 3600000,    // 1 hour
                minDataPoints: 10,
                trendThreshold: 0.1,        // 10% change
                correlationThreshold: 0.7,
                ...config.trends
            },
            
            // Prediction settings
            predictions: {
                enabled: config.prediction?.enabled ?? true,
                lookbackWindow: config.prediction?.lookbackWindow ?? 3600000, // 1 hour
                forecastWindow: 1800000,    // 30 minutes
                confidenceThreshold: 0.6,
                riskLevels: ['low', 'medium', 'high', 'critical'],
                ...config.prediction
            },
            
            // Visualization settings
            visualization: {
                generateChartData: true,
                timeSeriesResolution: 60000, // 1 minute
                maxDataPoints: 1440,        // 24 hours
                ...config.visualization
            }
        };
        
        // Alert state management
        this.alertState = {
            active: new Map(),          // alertId -> alert info
            history: [],                // Alert history
            suppressions: new Map(),    // componentId -> suppression info
            escalations: new Map(),     // alertId -> escalation info
            cooldowns: new Map(),       // alertKey -> cooldown timestamp
            channels: new Map()         // channel -> channel handler
        };
        
        // Trend analysis state
        this.trendState = {
            analyses: new Map(),        // componentId -> trend analysis
            patterns: new Map(),        // patternId -> pattern info
            correlations: new Map(),    // correlation pairs
            lastAnalysis: null
        };
        
        // Prediction state
        this.predictionState = {
            models: new Map(),          // componentId -> prediction model
            forecasts: new Map(),       // componentId -> forecast data
            risks: new Map(),           // componentId -> risk assessment
            lastPrediction: null
        };
        
        // Statistics
        this.stats = {
            reportsGenerated: 0,
            alertsTriggered: 0,
            alertsResolved: 0,
            trendsDetected: 0,
            predictionsGenerated: 0,
            startTime: Date.now()
        };
        
        // Initialize alert channels
        this.initializeAlertChannels();
        
        // Initialize trend analysis
        this.initializeTrendAnalysis();
        
        // Initialize prediction models
        this.initializePredictionModels();
    }
    
    /**
     * Initialize alert channels
     */
    initializeAlertChannels() {
        // Log channel
        this.alertState.channels.set('log', {
            name: 'log',
            handler: this.logAlertHandler.bind(this),
            enabled: true
        });
        
        // Event channel
        this.alertState.channels.set('event', {
            name: 'event',
            handler: this.eventAlertHandler.bind(this),
            enabled: true
        });
        
        // Console channel (for emergency alerts)
        this.alertState.channels.set('console', {
            name: 'console',
            handler: this.consoleAlertHandler.bind(this),
            enabled: true
        });
        
        // Webhook channel (placeholder)
        this.alertState.channels.set('webhook', {
            name: 'webhook',
            handler: this.webhookAlertHandler.bind(this),
            enabled: false
        });
    }
    
    /**
     * Initialize trend analysis
     */
    initializeTrendAnalysis() {
        if (!this.reporterConfig.trends.enabled) return;
        
        // Initialize trend detection algorithms
        this.trendAnalyzers = {
            linear: this.analyzeLinearTrend.bind(this),
            exponential: this.analyzeExponentialTrend.bind(this),
            seasonal: this.analyzeSeasonalTrend.bind(this),
            anomaly: this.analyzeAnomalyTrend.bind(this)
        };
    }
    
    /**
     * Initialize prediction models
     */
    initializePredictionModels() {
        if (!this.reporterConfig.predictions.enabled) return;
        
        // Initialize prediction algorithms
        this.predictors = {
            regression: this.linearRegressionPredictor.bind(this),
            movingAverage: this.movingAveragePredictor.bind(this),
            exponentialSmoothing: this.exponentialSmoothingPredictor.bind(this),
            threshold: this.thresholdPredictor.bind(this)
        };
    }
    
    /**
     * Generate comprehensive health report
     */
    async generateReport(healthMetrics, alertState, stats) {
        try {
            const startTime = Date.now();
            this.stats.reportsGenerated++;
            
            const report = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    timestamp: startTime,
                    reportType: 'comprehensive',
                    version: '1.0'
                },
                
                summary: this.generateSummary(healthMetrics, alertState),
                
                systemHealth: {
                    overall: healthMetrics.system.overall,
                    components: this.formatComponentHealth(healthMetrics.system.components),
                    protection: this.formatProtectionHealth(healthMetrics.system.protection),
                    performance: this.formatPerformanceMetrics(healthMetrics.system.performance)
                },
                
                alerts: {
                    active: Array.from(alertState.active.values()),
                    recent: alertState.history.slice(-20),
                    summary: this.generateAlertSummary(alertState)
                },
                
                trends: null,
                predictions: null,
                recommendations: [],
                
                statistics: {
                    ...stats,
                    reporterStats: this.stats
                }
            };
            
            // Add trend analysis if enabled
            if (this.reporterConfig.trends.enabled) {
                report.trends = await this.generateTrendAnalysis(healthMetrics);
            }
            
            // Add predictions if enabled
            if (this.reporterConfig.predictions.enabled) {
                report.predictions = await this.generatePredictions(healthMetrics, this.reporterConfig.predictions);
            }
            
            // Generate recommendations
            report.recommendations = this.generateRecommendations(report);
            
            // Add visualization data
            if (this.reporterConfig.visualization.generateChartData) {
                report.visualization = this.generateVisualizationData(healthMetrics);
            }
            
            const duration = Date.now() - startTime;
            report.metadata.generationTime = duration;
            
            this.logger.info('Health report generated successfully', {
                duration,
                componentsAnalyzed: healthMetrics.system.components.size,
                alertsActive: alertState.active.size
            });
            
            this.emit('report:generated', {
                report,
                duration,
                timestamp: startTime
            });
            
            return report;
            
        } catch (error) {
            this.logger.error('Error generating health report', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Generate report summary
     */
    generateSummary(healthMetrics, alertState) {
        const systemHealth = healthMetrics.system.overall;
        const totalComponents = healthMetrics.system.components.size;
        const failedComponents = systemHealth.failedComponents?.length || 0;
        const activeAlerts = alertState.active.size;
        
        return {
            status: systemHealth.status,
            score: systemHealth.score,
            components: {
                total: totalComponents,
                healthy: totalComponents - failedComponents,
                failed: failedComponents,
                healthPercent: totalComponents > 0 ? ((totalComponents - failedComponents) / totalComponents * 100).toFixed(1) : 100
            },
            alerts: {
                active: activeAlerts,
                critical: Array.from(alertState.active.values()).filter(a => a.level === 'critical').length,
                warning: Array.from(alertState.active.values()).filter(a => a.level === 'warning').length
            },
            emergency: systemHealth.emergency?.isActive || false,
            uptime: process.uptime()
        };
    }
    
    /**
     * Format component health for report
     */
    formatComponentHealth(componentHealth) {
        const formatted = {};
        
        for (const [componentId, health] of componentHealth) {
            formatted[componentId] = {
                status: health.status,
                score: health.score,
                lastCheck: health.timestamp,
                metrics: health.metrics,
                details: health.details
            };
        }
        
        return formatted;
    }
    
    /**
     * Format protection system health for report
     */
    formatProtectionHealth(protectionHealth) {
        const formatted = {};
        
        for (const [systemId, health] of protectionHealth) {
            formatted[systemId] = {
                status: health.status,
                score: health.score,
                lastCheck: health.timestamp,
                metrics: health.metrics,
                type: health.type || 'protection'
            };
        }
        
        return formatted;
    }
    
    /**
     * Format performance metrics for report
     */
    formatPerformanceMetrics(performanceMetrics) {
        const formatted = {};
        
        for (const [metricId, metrics] of performanceMetrics) {
            formatted[metricId] = {
                ...metrics,
                timestamp: metrics.timestamp
            };
        }
        
        return formatted;
    }
    
    /**
     * Generate alert summary
     */
    generateAlertSummary(alertState) {
        const alerts = Array.from(alertState.active.values());
        
        return {
            total: alerts.length,
            byLevel: {
                emergency: alerts.filter(a => a.level === 'emergency').length,
                critical: alerts.filter(a => a.level === 'critical').length,
                warning: alerts.filter(a => a.level === 'warning').length,
                info: alerts.filter(a => a.level === 'info').length
            },
            byComponent: this.groupAlertsByComponent(alerts),
            oldest: alerts.length > 0 ? Math.min(...alerts.map(a => a.timestamp)) : null,
            newest: alerts.length > 0 ? Math.max(...alerts.map(a => a.timestamp)) : null
        };
    }
    
    /**
     * Group alerts by component
     */
    groupAlertsByComponent(alerts) {
        const grouped = {};
        
        for (const alert of alerts) {
            const componentId = alert.componentId || 'system';
            if (!grouped[componentId]) {
                grouped[componentId] = [];
            }
            grouped[componentId].push(alert);
        }
        
        return grouped;
    }
    
    /**
     * Generate trend analysis
     */
    async generateTrendAnalysis(healthMetrics) {
        if (!this.reporterConfig.trends.enabled) return null;
        
        try {
            const trends = {};
            
            // Analyze system-wide trends
            trends.system = await this.analyzeSystemTrends(healthMetrics);
            
            // Analyze component trends
            trends.components = await this.analyzeComponentTrends(healthMetrics);
            
            // Analyze protection system trends
            trends.protection = await this.analyzeProtectionTrends(healthMetrics);
            
            // Detect correlations
            trends.correlations = await this.detectCorrelations(healthMetrics);
            
            // Store trend analysis results
            this.trendState.analyses.set('latest', trends);
            this.trendState.lastAnalysis = Date.now();
            
            this.stats.trendsDetected++;
            
            return trends;
            
        } catch (error) {
            this.logger.error('Error generating trend analysis', {
                error: error.message
            });
            return null;
        }
    }
    
    /**
     * Analyze system-wide trends
     */
    async analyzeSystemTrends(healthMetrics) {
        const history = healthMetrics.history || [];
        
        if (history.length < this.reporterConfig.trends.minDataPoints) {
            return { status: 'insufficient_data', message: 'Not enough data points for trend analysis' };
        }
        
        // Extract time series data
        const timeSeriesData = history.map(h => ({
            timestamp: h.timestamp,
            score: h.systemHealth.score,
            status: h.systemHealth.status
        }));
        
        // Analyze trends
        const trends = {};
        
        // Score trend
        trends.score = this.analyzeTimeSeries(timeSeriesData.map(d => ({ timestamp: d.timestamp, value: d.score })));
        
        // Status changes
        trends.statusChanges = this.analyzeStatusChanges(timeSeriesData);
        
        // Component failure patterns
        trends.failurePatterns = this.analyzeFailurePatterns(history);
        
        return trends;
    }
    
    /**
     * Analyze component trends
     */
    async analyzeComponentTrends(healthMetrics) {
        const componentTrends = {};
        
        for (const [componentId, componentHealth] of healthMetrics.system.components) {
            if (componentHealth.history && componentHealth.history.length >= this.reporterConfig.trends.minDataPoints) {
                const timeSeries = componentHealth.history.map(h => ({
                    timestamp: h.timestamp,
                    value: h.score
                }));
                
                componentTrends[componentId] = this.analyzeTimeSeries(timeSeries);
            }
        }
        
        return componentTrends;
    }
    
    /**
     * Analyze protection system trends
     */
    async analyzeProtectionTrends(healthMetrics) {
        const protectionTrends = {};
        
        for (const [systemId, protectionHealth] of healthMetrics.system.protection) {
            if (protectionHealth.metrics && protectionHealth.history) {
                const timeSeries = protectionHealth.history.map(h => ({
                    timestamp: h.timestamp,
                    value: h.score
                }));
                
                protectionTrends[systemId] = this.analyzeTimeSeries(timeSeries);
            }
        }
        
        return protectionTrends;
    }
    
    /**
     * Analyze time series data for trends
     */
    analyzeTimeSeries(timeSeries) {
        if (timeSeries.length < 2) {
            return { trend: 'unknown', confidence: 0 };
        }
        
        const analysis = {
            trend: 'stable',
            direction: 'none',
            confidence: 0,
            slope: 0,
            correlation: 0,
            volatility: 0,
            outliers: []
        };
        
        // Linear regression analysis
        const linearTrend = this.trendAnalyzers.linear(timeSeries);
        analysis.slope = linearTrend.slope;
        analysis.correlation = linearTrend.correlation;
        
        // Determine trend direction
        if (Math.abs(linearTrend.slope) > this.reporterConfig.trends.trendThreshold) {
            analysis.trend = linearTrend.slope > 0 ? 'improving' : 'degrading';
            analysis.direction = linearTrend.slope > 0 ? 'up' : 'down';
            analysis.confidence = Math.abs(linearTrend.correlation);
        }
        
        // Calculate volatility
        analysis.volatility = this.calculateVolatility(timeSeries);
        
        // Detect outliers
        analysis.outliers = this.detectOutliers(timeSeries);
        
        return analysis;
    }
    
    /**
     * Linear trend analysis
     */
    analyzeLinearTrend(timeSeries) {
        const n = timeSeries.length;
        const sumX = timeSeries.reduce((sum, point, index) => sum + index, 0);
        const sumY = timeSeries.reduce((sum, point) => sum + point.value, 0);
        const sumXY = timeSeries.reduce((sum, point, index) => sum + index * point.value, 0);
        const sumXX = timeSeries.reduce((sum, point, index) => sum + index * index, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate correlation coefficient
        const meanX = sumX / n;
        const meanY = sumY / n;
        
        const numerator = timeSeries.reduce((sum, point, index) => 
            sum + (index - meanX) * (point.value - meanY), 0);
        const denominatorX = Math.sqrt(timeSeries.reduce((sum, point, index) => 
            sum + (index - meanX) ** 2, 0));
        const denominatorY = Math.sqrt(timeSeries.reduce((sum, point) => 
            sum + (point.value - meanY) ** 2, 0));
        
        const correlation = denominatorX * denominatorY !== 0 ? 
            numerator / (denominatorX * denominatorY) : 0;
        
        return { slope, intercept, correlation };
    }
    
    /**
     * Exponential trend analysis
     */
    analyzeExponentialTrend(timeSeries) {
        // Simplified exponential trend detection
        const recent = timeSeries.slice(-5);
        const early = timeSeries.slice(0, 5);
        
        if (recent.length < 2 || early.length < 2) return { exponential: false };
        
        const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
        const earlyAvg = early.reduce((sum, p) => sum + p.value, 0) / early.length;
        
        const ratio = recentAvg / earlyAvg;
        
        return {
            exponential: ratio > 1.5 || ratio < 0.5,
            ratio,
            direction: ratio > 1 ? 'increasing' : 'decreasing'
        };
    }
    
    /**
     * Seasonal trend analysis
     */
    analyzeSeasonalTrend(timeSeries) {
        // Simplified seasonal pattern detection
        // This would need more sophisticated algorithms for real seasonal analysis
        return { seasonal: false, period: null };
    }
    
    /**
     * Anomaly trend analysis
     */
    analyzeAnomalyTrend(timeSeries) {
        const mean = timeSeries.reduce((sum, p) => sum + p.value, 0) / timeSeries.length;
        const stdDev = Math.sqrt(
            timeSeries.reduce((sum, p) => sum + (p.value - mean) ** 2, 0) / timeSeries.length
        );
        
        const anomalies = timeSeries.filter(p => 
            Math.abs(p.value - mean) > 2 * stdDev
        );
        
        return {
            anomalies: anomalies.length,
            anomalyRate: anomalies.length / timeSeries.length,
            threshold: 2 * stdDev
        };
    }
    
    /**
     * Analyze status changes
     */
    analyzeStatusChanges(timeSeriesData) {
        const changes = [];
        
        for (let i = 1; i < timeSeriesData.length; i++) {
            if (timeSeriesData[i].status !== timeSeriesData[i-1].status) {
                changes.push({
                    timestamp: timeSeriesData[i].timestamp,
                    from: timeSeriesData[i-1].status,
                    to: timeSeriesData[i].status
                });
            }
        }
        
        return {
            total: changes.length,
            changes,
            stability: 1 - (changes.length / timeSeriesData.length)
        };
    }
    
    /**
     * Analyze failure patterns
     */
    analyzeFailurePatterns(history) {
        const failures = history.filter(h => 
            h.systemHealth.status === 'failed' || h.systemHealth.status === 'critical'
        );
        
        if (failures.length === 0) {
            return { patterns: [], frequency: 0 };
        }
        
        // Analyze failure frequency
        const timeSpans = [];
        for (let i = 1; i < failures.length; i++) {
            timeSpans.push(failures[i].timestamp - failures[i-1].timestamp);
        }
        
        const avgTimeBetweenFailures = timeSpans.length > 0 ? 
            timeSpans.reduce((sum, span) => sum + span, 0) / timeSpans.length : 0;
        
        return {
            totalFailures: failures.length,
            frequency: avgTimeBetweenFailures,
            patterns: this.detectFailurePatterns(failures)
        };
    }
    
    /**
     * Detect failure patterns
     */
    detectFailurePatterns(failures) {
        // Simplified pattern detection
        const patterns = [];
        
        // Check for recurring component failures
        const componentFailures = {};
        
        for (const failure of failures) {
            for (const component of failure.systemHealth.failedComponents || []) {
                componentFailures[component] = (componentFailures[component] || 0) + 1;
            }
        }
        
        // Identify components that fail frequently
        for (const [component, count] of Object.entries(componentFailures)) {
            if (count >= 3) {
                patterns.push({
                    type: 'recurring_component_failure',
                    component,
                    count,
                    severity: count > 5 ? 'high' : 'medium'
                });
            }
        }
        
        return patterns;
    }
    
    /**
     * Detect correlations between components
     */
    async detectCorrelations(healthMetrics) {
        const correlations = [];
        const components = Array.from(healthMetrics.system.components.keys());
        
        // Analyze correlations between component pairs
        for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
                const correlation = this.calculateComponentCorrelation(
                    healthMetrics.system.components.get(components[i]),
                    healthMetrics.system.components.get(components[j])
                );
                
                if (Math.abs(correlation) > this.reporterConfig.trends.correlationThreshold) {
                    correlations.push({
                        component1: components[i],
                        component2: components[j],
                        correlation,
                        strength: Math.abs(correlation) > 0.8 ? 'strong' : 'moderate'
                    });
                }
            }
        }
        
        return correlations;
    }
    
    /**
     * Calculate correlation between two components
     */
    calculateComponentCorrelation(component1, component2) {
        const history1 = component1.history || [];
        const history2 = component2.history || [];
        
        if (history1.length < 10 || history2.length < 10) return 0;
        
        // Align time series data
        const aligned = this.alignTimeSeries(history1, history2);
        
        if (aligned.length < 5) return 0;
        
        // Calculate Pearson correlation coefficient
        const values1 = aligned.map(pair => pair.value1);
        const values2 = aligned.map(pair => pair.value2);
        
        const mean1 = values1.reduce((sum, v) => sum + v, 0) / values1.length;
        const mean2 = values2.reduce((sum, v) => sum + v, 0) / values2.length;
        
        const numerator = aligned.reduce((sum, pair) => 
            sum + (pair.value1 - mean1) * (pair.value2 - mean2), 0);
        
        const denominator1 = Math.sqrt(values1.reduce((sum, v) => sum + (v - mean1) ** 2, 0));
        const denominator2 = Math.sqrt(values2.reduce((sum, v) => sum + (v - mean2) ** 2, 0));
        
        return denominator1 * denominator2 !== 0 ? 
            numerator / (denominator1 * denominator2) : 0;
    }
    
    /**
     * Align time series data for correlation analysis
     */
    alignTimeSeries(series1, series2) {
        const aligned = [];
        const tolerance = 60000; // 1 minute tolerance
        
        for (const point1 of series1) {
            const matchingPoint = series2.find(point2 => 
                Math.abs(point1.timestamp - point2.timestamp) <= tolerance
            );
            
            if (matchingPoint) {
                aligned.push({
                    timestamp: point1.timestamp,
                    value1: point1.score,
                    value2: matchingPoint.score
                });
            }
        }
        
        return aligned;
    }
    
    /**
     * Generate predictions
     */
    async generatePredictions(healthMetrics, predictionConfig) {
        if (!this.reporterConfig.predictions.enabled) return null;
        
        try {
            const predictions = {};
            
            // Generate system-wide predictions
            predictions.system = await this.generateSystemPredictions(healthMetrics);
            
            // Generate component predictions
            predictions.components = await this.generateComponentPredictions(healthMetrics);
            
            // Generate risk assessments
            predictions.risks = await this.generateRiskAssessments(healthMetrics);
            
            // Store prediction results
            this.predictionState.forecasts.set('latest', predictions);
            this.predictionState.lastPrediction = Date.now();
            
            this.stats.predictionsGenerated++;
            
            return predictions;
            
        } catch (error) {
            this.logger.error('Error generating predictions', {
                error: error.message
            });
            return null;
        }
    }
    
    /**
     * Generate system-wide predictions
     */
    async generateSystemPredictions(healthMetrics) {
        const history = healthMetrics.history || [];
        
        if (history.length < this.reporterConfig.trends.minDataPoints) {
            return { status: 'insufficient_data' };
        }
        
        const timeSeries = history.map(h => ({
            timestamp: h.timestamp,
            value: h.systemHealth.score
        }));
        
        // Use multiple prediction methods
        const predictions = {};
        
        predictions.regression = this.predictors.regression(timeSeries);
        predictions.movingAverage = this.predictors.movingAverage(timeSeries);
        predictions.exponentialSmoothing = this.predictors.exponentialSmoothing(timeSeries);
        predictions.threshold = this.predictors.threshold(timeSeries);
        
        // Combine predictions
        predictions.combined = this.combinePredictions(Object.values(predictions));
        
        return predictions;
    }
    
    /**
     * Generate component predictions
     */
    async generateComponentPredictions(healthMetrics) {
        const componentPredictions = {};
        
        for (const [componentId, componentHealth] of healthMetrics.system.components) {
            if (componentHealth.history && componentHealth.history.length >= this.reporterConfig.trends.minDataPoints) {
                const timeSeries = componentHealth.history.map(h => ({
                    timestamp: h.timestamp,
                    value: h.score
                }));
                
                componentPredictions[componentId] = this.predictors.regression(timeSeries);
            }
        }
        
        return componentPredictions;
    }
    
    /**
     * Generate risk assessments
     */
    async generateRiskAssessments(healthMetrics) {
        const risks = {};
        
        // System-wide risk assessment
        risks.system = this.assessSystemRisk(healthMetrics);
        
        // Component risk assessments
        risks.components = {};
        for (const [componentId, componentHealth] of healthMetrics.system.components) {
            risks.components[componentId] = this.assessComponentRisk(componentId, componentHealth, healthMetrics);
        }
        
        return risks;
    }
    
    /**
     * Assess system risk
     */
    assessSystemRisk(healthMetrics) {
        const systemHealth = healthMetrics.system.overall;
        let risk = 'low';
        const factors = [];
        
        // Current health score
        if (systemHealth.score < 0.5) {
            risk = 'critical';
            factors.push('low_health_score');
        } else if (systemHealth.score < 0.7) {
            risk = 'high';
            factors.push('degraded_health_score');
        }
        
        // Failed components
        const failedCount = systemHealth.failedComponents?.length || 0;
        if (failedCount > 0) {
            if (failedCount > 2) {
                risk = this.escalateRisk(risk, 'high');
                factors.push('multiple_component_failures');
            } else {
                risk = this.escalateRisk(risk, 'medium');
                factors.push('component_failures');
            }
        }
        
        // Emergency state
        if (systemHealth.emergency?.isActive) {
            risk = 'critical';
            factors.push('emergency_mode_active');
        }
        
        return { risk, factors, confidence: 0.8 };
    }
    
    /**
     * Assess component risk
     */
    assessComponentRisk(componentId, componentHealth, healthMetrics) {
        let risk = 'low';
        const factors = [];
        
        // Current health status
        if (componentHealth.status === 'failed' || componentHealth.status === 'critical') {
            risk = 'critical';
            factors.push('current_failure');
        } else if (componentHealth.status === 'degraded') {
            risk = 'medium';
            factors.push('degraded_status');
        }
        
        // Trend analysis
        const trends = this.trendState.analyses.get('latest');
        if (trends?.components?.[componentId]?.trend === 'degrading') {
            risk = this.escalateRisk(risk, 'medium');
            factors.push('degrading_trend');
        }
        
        // Historical failures
        const history = componentHealth.history || [];
        const recentFailures = history.filter(h => 
            (Date.now() - h.timestamp) < 3600000 && // Last hour
            (h.status === 'failed' || h.status === 'critical')
        ).length;
        
        if (recentFailures > 0) {
            risk = this.escalateRisk(risk, recentFailures > 2 ? 'high' : 'medium');
            factors.push('recent_failures');
        }
        
        return { risk, factors, confidence: 0.7 };
    }
    
    /**
     * Escalate risk level
     */
    escalateRisk(currentRisk, newRisk) {
        const riskLevels = { low: 0, medium: 1, high: 2, critical: 3 };
        const currentLevel = riskLevels[currentRisk] || 0;
        const newLevel = riskLevels[newRisk] || 0;
        
        const maxLevel = Math.max(currentLevel, newLevel);
        return Object.keys(riskLevels).find(key => riskLevels[key] === maxLevel);
    }
    
    /**
     * Linear regression predictor
     */
    linearRegressionPredictor(timeSeries) {
        if (timeSeries.length < 3) {
            return { prediction: null, confidence: 0 };
        }
        
        const trend = this.trendAnalyzers.linear(timeSeries);
        const forecastSteps = Math.floor(this.reporterConfig.predictions.forecastWindow / 60000); // Minutes
        
        const lastIndex = timeSeries.length - 1;
        const predictedValue = trend.slope * (lastIndex + forecastSteps) + trend.intercept;
        
        return {
            prediction: Math.max(0, Math.min(1, predictedValue)),
            confidence: Math.abs(trend.correlation),
            method: 'linear_regression',
            forecastTime: this.reporterConfig.predictions.forecastWindow
        };
    }
    
    /**
     * Moving average predictor
     */
    movingAveragePredictor(timeSeries) {
        if (timeSeries.length < 5) {
            return { prediction: null, confidence: 0 };
        }
        
        const windowSize = Math.min(5, timeSeries.length);
        const recentValues = timeSeries.slice(-windowSize).map(p => p.value);
        const prediction = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
        
        return {
            prediction,
            confidence: 0.6,
            method: 'moving_average',
            windowSize
        };
    }
    
    /**
     * Exponential smoothing predictor
     */
    exponentialSmoothingPredictor(timeSeries) {
        if (timeSeries.length < 3) {
            return { prediction: null, confidence: 0 };
        }
        
        const alpha = 0.3; // Smoothing factor
        let smoothed = timeSeries[0].value;
        
        for (let i = 1; i < timeSeries.length; i++) {
            smoothed = alpha * timeSeries[i].value + (1 - alpha) * smoothed;
        }
        
        return {
            prediction: smoothed,
            confidence: 0.7,
            method: 'exponential_smoothing',
            alpha
        };
    }
    
    /**
     * Threshold predictor
     */
    thresholdPredictor(timeSeries) {
        if (timeSeries.length < 5) {
            return { prediction: null, confidence: 0 };
        }
        
        const values = timeSeries.map(p => p.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const recentMean = values.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
        
        let risk = 'low';
        if (recentMean < 0.3) risk = 'critical';
        else if (recentMean < 0.5) risk = 'high';
        else if (recentMean < 0.7) risk = 'medium';
        
        return {
            prediction: recentMean,
            risk,
            confidence: 0.5,
            method: 'threshold_based'
        };
    }
    
    /**
     * Combine multiple predictions
     */
    combinePredictions(predictions) {
        const validPredictions = predictions.filter(p => p.prediction !== null);
        
        if (validPredictions.length === 0) {
            return { prediction: null, confidence: 0 };
        }
        
        // Weighted average based on confidence
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (const pred of validPredictions) {
            weightedSum += pred.prediction * pred.confidence;
            totalWeight += pred.confidence;
        }
        
        const combinedPrediction = totalWeight > 0 ? weightedSum / totalWeight : null;
        const combinedConfidence = totalWeight / validPredictions.length;
        
        return {
            prediction: combinedPrediction,
            confidence: combinedConfidence,
            method: 'weighted_combination',
            contributingMethods: validPredictions.map(p => p.method)
        };
    }
    
    /**
     * Calculate volatility
     */
    calculateVolatility(timeSeries) {
        if (timeSeries.length < 2) return 0;
        
        const values = timeSeries.map(p => p.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
        
        return Math.sqrt(variance);
    }
    
    /**
     * Detect outliers
     */
    detectOutliers(timeSeries) {
        const values = timeSeries.map(p => p.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const stdDev = Math.sqrt(
            values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
        );
        
        const threshold = 2 * stdDev;
        
        return timeSeries.filter(point => 
            Math.abs(point.value - mean) > threshold
        ).map(point => ({
            timestamp: point.timestamp,
            value: point.value,
            deviation: Math.abs(point.value - mean)
        }));
    }
    
    /**
     * Generate recommendations
     */
    generateRecommendations(report) {
        const recommendations = [];
        
        // System health recommendations
        if (report.systemHealth.overall.status === 'critical' || report.systemHealth.overall.status === 'failed') {
            recommendations.push({
                type: 'critical',
                category: 'system',
                title: 'System Health Critical',
                description: 'System health is critical. Immediate attention required.',
                actions: ['Check failed components', 'Review error logs', 'Consider emergency recovery'],
                priority: 'immediate'
            });
        }
        
        // Component recommendations
        const failedComponents = report.systemHealth.overall.failedComponents || [];
        if (failedComponents.length > 0) {
            recommendations.push({
                type: 'warning',
                category: 'components',
                title: 'Component Failures Detected',
                description: `${failedComponents.length} components are currently failed.`,
                actions: [`Investigate components: ${failedComponents.join(', ')}`, 'Check component logs', 'Restart failed components'],
                priority: 'high'
            });
        }
        
        // Alert recommendations
        const criticalAlerts = report.alerts.active.filter(a => a.level === 'critical');
        if (criticalAlerts.length > 0) {
            recommendations.push({
                type: 'critical',
                category: 'alerts',
                title: 'Critical Alerts Active',
                description: `${criticalAlerts.length} critical alerts are currently active.`,
                actions: ['Review critical alerts', 'Address root causes', 'Update alert thresholds if needed'],
                priority: 'immediate'
            });
        }
        
        // Trend-based recommendations
        if (report.trends) {
            if (report.trends.system?.score?.trend === 'degrading') {
                recommendations.push({
                    type: 'warning',
                    category: 'trends',
                    title: 'System Health Degrading',
                    description: 'System health score is showing a degrading trend.',
                    actions: ['Monitor system closely', 'Identify degradation causes', 'Plan preventive maintenance'],
                    priority: 'medium'
                });
            }
        }
        
        // Prediction-based recommendations
        if (report.predictions) {
            const systemRisk = report.predictions.risks?.system;
            if (systemRisk && (systemRisk.risk === 'high' || systemRisk.risk === 'critical')) {
                recommendations.push({
                    type: 'warning',
                    category: 'predictions',
                    title: 'High Risk Predicted',
                    description: `System risk assessment indicates ${systemRisk.risk} risk.`,
                    actions: ['Review risk factors', 'Implement preventive measures', 'Increase monitoring frequency'],
                    priority: systemRisk.risk === 'critical' ? 'high' : 'medium'
                });
            }
        }
        
        return recommendations;
    }
    
    /**
     * Generate visualization data
     */
    generateVisualizationData(healthMetrics) {
        const visualization = {
            timeSeries: {},
            charts: {},
            dashboards: {}
        };
        
        // System health time series
        const history = healthMetrics.history || [];
        visualization.timeSeries.systemHealth = history.map(h => ({
            timestamp: h.timestamp,
            score: h.systemHealth.score,
            status: h.systemHealth.status
        }));
        
        // Component health chart data
        visualization.charts.componentHealth = {};
        for (const [componentId, componentHealth] of healthMetrics.system.components) {
            visualization.charts.componentHealth[componentId] = {
                status: componentHealth.status,
                score: componentHealth.score,
                history: componentHealth.history || []
            };
        }
        
        // Alert distribution
        visualization.charts.alertDistribution = {
            byLevel: this.alertState.history.reduce((acc, alert) => {
                acc[alert.level] = (acc[alert.level] || 0) + 1;
                return acc;
            }, {}),
            byComponent: this.groupAlertsByComponent(this.alertState.history)
        };
        
        return visualization;
    }
    
    // ===== Alert Management =====
    
    /**
     * Trigger alert
     */
    async triggerAlert(alertConfig) {
        try {
            const alertId = this.generateAlertId();
            const alert = {
                alertId,
                ...alertConfig,
                timestamp: Date.now(),
                status: 'active'
            };
            
            // Check cooldown
            const alertKey = `${alert.componentId}:${alert.type}`;
            const lastAlert = this.alertState.cooldowns.get(alertKey);
            if (lastAlert && (Date.now() - lastAlert) < this.reporterConfig.alerts.cooldown) {
                this.logger.debug('Alert suppressed due to cooldown', { alertKey });
                return null;
            }
            
            // Store alert
            this.alertState.active.set(alertId, alert);
            this.alertState.history.push(alert);
            this.alertState.cooldowns.set(alertKey, Date.now());
            
            // Send through configured channels
            if (this.reporterConfig.alerts.enabled) {
                await this.sendAlert(alert);
            }
            
            this.stats.alertsTriggered++;
            
            this.emit('alert:triggered', alert);
            
            return alert;
            
        } catch (error) {
            this.logger.error('Error triggering alert', {
                error: error.message,
                alertConfig
            });
        }
    }
    
    /**
     * Resolve alert
     */
    async resolveAlert(alertId, reason = 'resolved') {
        const alert = this.alertState.active.get(alertId);
        if (!alert) {
            return null;
        }
        
        alert.status = 'resolved';
        alert.resolvedAt = Date.now();
        alert.resolvedReason = reason;
        
        this.alertState.active.delete(alertId);
        this.alertState.history.push({ ...alert, action: 'resolved' });
        
        this.stats.alertsResolved++;
        
        this.emit('alert:resolved', alert);
        
        return alert;
    }
    
    /**
     * Send alert through configured channels
     */
    async sendAlert(alert) {
        const enabledChannels = this.reporterConfig.alerts.channels.filter(channel =>
            this.alertState.channels.has(channel) &&
            this.alertState.channels.get(channel).enabled
        );
        
        for (const channelName of enabledChannels) {
            const channel = this.alertState.channels.get(channelName);
            try {
                await channel.handler(alert);
            } catch (error) {
                this.logger.error(`Error sending alert to channel ${channelName}`, {
                    error: error.message,
                    alertId: alert.alertId
                });
            }
        }
    }
    
    /**
     * Log alert handler
     */
    async logAlertHandler(alert) {
        const logLevel = this.getLogLevelForAlert(alert.level);
        this.logger[logLevel](`ALERT: ${alert.title}`, {
            alertId: alert.alertId,
            componentId: alert.componentId,
            level: alert.level,
            message: alert.message,
            timestamp: alert.timestamp
        });
    }
    
    /**
     * Event alert handler
     */
    async eventAlertHandler(alert) {
        this.emit('health:alert', alert);
    }
    
    /**
     * Console alert handler
     */
    async consoleAlertHandler(alert) {
        if (alert.level === 'emergency' || alert.level === 'critical') {
            console.error(`[HEALTH ALERT] ${alert.level.toUpperCase()}: ${alert.title}`);
            console.error(`Component: ${alert.componentId}`);
            console.error(`Message: ${alert.message}`);
            console.error(`Time: ${new Date(alert.timestamp).toISOString()}`);
        }
    }
    
    /**
     * Webhook alert handler
     */
    async webhookAlertHandler(alert) {
        // Placeholder for webhook implementation
        this.logger.debug('Webhook alert handler called', { alertId: alert.alertId });
    }
    
    /**
     * Get log level for alert level
     */
    getLogLevelForAlert(alertLevel) {
        const mapping = {
            info: 'info',
            warning: 'warn',
            critical: 'error',
            emergency: 'error'
        };
        return mapping[alertLevel] || 'info';
    }
    
    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // ===== Public API =====
    
    /**
     * Get alert history
     */
    getAlertHistory(limit = 50) {
        return this.alertState.history.slice(-limit);
    }
    
    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return Array.from(this.alertState.active.values());
    }
    
    /**
     * Get trend analysis
     */
    getTrendAnalysis() {
        return this.trendState.analyses.get('latest');
    }
    
    /**
     * Get predictions
     */
    getPredictions() {
        return this.predictionState.forecasts.get('latest');
    }
    
    /**
     * Get reporter statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime
        };
    }
    
    /**
     * Get reporter configuration
     */
    getConfig() {
        return { ...this.reporterConfig };
    }
    
    /**
     * Update reporter configuration
     */
    updateConfig(newConfig) {
        this.reporterConfig = { ...this.reporterConfig, ...newConfig };
        this.logger.info('Health reporter configuration updated');
    }
    
    /**
     * Shutdown health reporter
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Health Reporter');
            
            // Clear all state
            this.alertState.active.clear();
            this.alertState.cooldowns.clear();
            this.trendState.analyses.clear();
            this.predictionState.forecasts.clear();
            
            // Remove all listeners
            this.removeAllListeners();
            
            this.logger.info('Health Reporter shut down successfully');
            
        } catch (error) {
            this.logger.error('Error shutting down Health Reporter', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}

export default HealthReporter;