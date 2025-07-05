/**
 * Timer Integration Helper
 * Helps integrate the global timer manager with existing bot components
 */

import { getGlobalTimerManager } from './TimerManager.js';

/**
 * Setup timer monitoring for the bot
 */
export function setupBotTimerMonitoring(bot, logger) {
    const timerManager = getGlobalTimerManager(logger);
    
    // Configure timer manager for bot environment
    timerManager.updateConfig({
        monitorInterval: 60000, // 1 minute monitoring
        leakDetectionInterval: 120000, // 2 minute leak detection
        maxTimersPerComponent: 100, // Higher limit for bot components
        maxTotalTimers: 1000,
        alertThreshold: 200
    });
    
    // Register major bot components
    if (bot.imageHealthChecker) {
        timerManager.registerComponent('imageHealthChecker', bot.imageHealthChecker);
    }
    
    if (bot.batchScheduler) {
        timerManager.registerComponent('batchScheduler', bot.batchScheduler);
    }
    
    if (bot.connectionHandler) {
        timerManager.registerComponent('connectionHandler', bot.connectionHandler);
    }
    
    if (bot.cooldownManager) {
        timerManager.registerComponent('cooldownManager', bot.cooldownManager);
    }
    
    if (bot.cashMonitor) {
        timerManager.registerComponent('cashMonitor', bot.cashMonitor);
    }
    
    // Register modules if they exist
    if (bot.modules && bot.modules.size > 0) {
        for (const [moduleId, moduleInfo] of bot.modules) {
            if (moduleInfo.instance) {
                timerManager.registerComponent(`module-${moduleId}`, moduleInfo.instance);
            }
        }
    }
    
    // Start monitoring
    timerManager.startMonitoring();
    
    // Add timer stats to bot API if it exists
    if (bot.apiServer) {
        bot.apiServer.app.get('/api/timer-stats', (req, res) => {
            try {
                const stats = timerManager.getStats();
                res.json({
                    success: true,
                    data: stats,
                    timestamp: Date.now()
                });
            } catch (error) {
                logger.error('Error getting timer stats:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get timer statistics'
                });
            }
        });
        
        bot.apiServer.app.post('/api/timer-leak-check', (req, res) => {
            try {
                timerManager.runLeakDetection();
                res.json({
                    success: true,
                    message: 'Leak detection run completed',
                    timestamp: Date.now()
                });
            } catch (error) {
                logger.error('Error running leak detection:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to run leak detection'
                });
            }
        });
        
        bot.apiServer.app.post('/api/timer-emergency-cleanup', (req, res) => {
            try {
                timerManager.triggerEmergencyCleanup('manual_api_request');
                res.json({
                    success: true,
                    message: 'Emergency cleanup triggered',
                    timestamp: Date.now()
                });
            } catch (error) {
                logger.error('Error triggering emergency cleanup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to trigger emergency cleanup'
                });
            }
        });
    }
    
    logger.info('Timer monitoring setup completed');
    return timerManager;
}

/**
 * Add timer monitoring command for admin users
 */
export function addTimerMonitoringCommand(bot, commandHandler) {
    if (!commandHandler) return;
    
    commandHandler.registerCommand('timerstats', {
        description: 'Show timer statistics and detect leaks',
        adminOnly: true,
        cooldown: 10,
        handler: async (context) => {
            try {
                const timerManager = getGlobalTimerManager();
                const stats = timerManager.getStats();
                
                let response = `🔧 **Timer Statistics**\n`;
                response += `📊 Global: ${stats.globalTimers} tracked, ${stats.registeredComponents} components\n`;
                response += `📈 Total: ${stats.totalTimersCreated} created, ${stats.totalTimersCleared} cleared\n`;
                response += `⚠️ Issues: ${stats.leaksDetected} leaks detected, ${stats.emergencyCleanups} emergency cleanups\n`;
                response += `🔍 Monitoring: ${stats.isMonitoring ? 'Active' : 'Inactive'}\n\n`;
                
                // Component breakdown
                if (stats.components.length > 0) {
                    response += `**Component Breakdown:**\n`;
                    for (const comp of stats.components) {
                        const status = comp.hasTimerSupport ? '✅' : '❌';
                        response += `${status} ${comp.name}: ${comp.timerCount} timers`;
                        if (comp.leakCount > 0) {
                            response += ` (${comp.leakCount} leaks detected)`;
                        }
                        response += `\n`;
                    }
                }
                
                return response;
            } catch (error) {
                bot.logger.error('Error getting timer stats:', error);
                return 'Error retrieving timer statistics';
            }
        }
    });
    
    commandHandler.registerCommand('timerleakcheck', {
        description: 'Run timer leak detection',
        adminOnly: true,
        cooldown: 30,
        handler: async (context) => {
            try {
                const timerManager = getGlobalTimerManager();
                timerManager.runLeakDetection();
                return '🔍 Timer leak detection initiated. Check logs for results.';
            } catch (error) {
                bot.logger.error('Error running leak detection:', error);
                return 'Error running timer leak detection';
            }
        }
    });
    
    commandHandler.registerCommand('timercleanup', {
        description: 'Trigger emergency timer cleanup (use with caution)',
        adminOnly: true,
        cooldown: 60,
        handler: async (context) => {
            try {
                const timerManager = getGlobalTimerManager();
                timerManager.triggerEmergencyCleanup('manual_admin_command');
                return '🚨 Emergency timer cleanup triggered. All timers have been cleared.';
            } catch (error) {
                bot.logger.error('Error triggering emergency cleanup:', error);
                return 'Error triggering emergency timer cleanup';
            }
        }
    });
}

/**
 * Create a wrapper for setTimeout that integrates with global tracking
 */
export function createTrackedTimeout(callback, delay, description = 'tracked-timeout') {
    const timerManager = getGlobalTimerManager();
    
    const timeoutId = setTimeout(() => {
        timerManager.untrackTimer(timeoutId);
        callback();
    }, delay);
    
    timerManager.trackTimer(timeoutId, {
        type: 'timeout',
        description,
        delay,
        component: 'global'
    });
    
    return timeoutId;
}

/**
 * Create a wrapper for setInterval that integrates with global tracking
 */
export function createTrackedInterval(callback, interval, description = 'tracked-interval') {
    const timerManager = getGlobalTimerManager();
    
    const intervalId = setInterval(callback, interval);
    
    timerManager.trackTimer(intervalId, {
        type: 'interval',
        description,
        interval,
        component: 'global'
    });
    
    return intervalId;
}

/**
 * Clear a tracked timeout
 */
export function clearTrackedTimeout(timeoutId) {
    const timerManager = getGlobalTimerManager();
    timerManager.untrackTimer(timeoutId);
    clearTimeout(timeoutId);
}

/**
 * Clear a tracked interval
 */
export function clearTrackedInterval(intervalId) {
    const timerManager = getGlobalTimerManager();
    timerManager.untrackTimer(intervalId);
    clearInterval(intervalId);
}

export default {
    setupBotTimerMonitoring,
    addTimerMonitoringCommand,
    createTrackedTimeout,
    createTrackedInterval,
    clearTrackedTimeout,
    clearTrackedInterval
};