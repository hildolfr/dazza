import { Command } from '../base.js';

export default new Command({
    name: 'memory',
    aliases: ['mem'],
    description: 'Show current memory usage and statistics',
    usage: '!memory [-v|--verbose]',
    category: 'admin',
    users: ['hildolfr'],
    cooldown: 5000,
    
    async handler(bot, message, args) {
        try {
            // Get memory management service
            const memoryService = bot.services?.get('memoryManagement');
            
            if (!memoryService) {
                bot.sendMessage(message.roomId, 'memory management service not available mate');
                return { success: true };
            }
            
            const stats = memoryService.getMemoryStats();
            
            if (!stats) {
                bot.sendMessage(message.roomId, 'no memory stats available yet, gimme a sec');
                return { success: true };
            }
            
            // Use enhanced stats if available, fallback to legacy
            const currentStats = stats.enhanced?.pressure?.current || stats.legacy?.current;
            
            if (!currentStats) {
                bot.sendMessage(message.roomId, 'memory stats not ready yet mate');
                return { success: true };
            }
            
            // Format the main response
            let response = `memory usage: ${currentStats.heapUsedMB}MB`;
            
            if (stats.enhanced) {
                // Enhanced monitoring response
                response += ` (${currentStats.heapPercent}%) | `;
                response += `pressure: ${stats.enhanced.system.currentPressureLevel} | `;
                response += `RSS: ${currentStats.rssMB}MB | `;
                response += `external: ${currentStats.externalMB}MB`;
                
                // Add pressure level indicators
                if (stats.enhanced.system.emergencyMode) {
                    response += ' 🚨 EMERGENCY MODE';
                } else if (currentStats.heapPercent >= 95) {
                    response += ' 🚨 CRITICAL';
                } else if (currentStats.heapPercent >= 90) {
                    response += ' ⚠️ HIGH PRESSURE';
                } else if (currentStats.heapPercent >= 80) {
                    response += ' ⚠️ WARNING';
                }
            } else {
                // Legacy monitoring response
                response += ` / ${currentStats.heapTotalMB}MB heap (${currentStats.heapPercent}%) | `;
                response += `RSS: ${currentStats.rssMB}MB | `;
                response += `external: ${currentStats.externalMB}MB | `;
                response += `trend: ${stats.legacy?.trend || 'unknown'}`;
                
                // Add warning if memory is high
                if (currentStats.heapPercent > 95) {
                    response += ' 🚨 CRITICAL';
                } else if (currentStats.heapPercent > 85) {
                    response += ' ⚠️ HIGH MEMORY';
                }
            }
            
            bot.sendMessage(message.roomId, response);
            
            // If verbose flag is set, show more details
            if (args[0] === '-v' || args[0] === '--verbose') {
                setTimeout(() => {
                    if (stats.enhanced) {
                        // Enhanced verbose information
                        const systemStats = stats.enhanced.stats;
                        const pressureStats = stats.enhanced.pressure.stats;
                        
                        let details = `system uptime: ${Math.floor(systemStats.uptime / 3600)}h ${Math.floor((systemStats.uptime % 3600) / 60)}m | `;
                        details += `total alerts: ${systemStats.totalAlerts} | `;
                        details += `cleanups: ${systemStats.totalCleanups} | `;
                        details += `memory freed: ${Math.round(systemStats.totalMemoryFreed / 1024 / 1024)}MB`;
                        
                        bot.sendMessage(message.roomId, details);
                        
                        // Show pressure events if any
                        if (pressureStats.pressureEvents) {
                            setTimeout(() => {
                                const events = pressureStats.pressureEvents;
                                let eventDetails = `pressure events: warning=${events.warning}, critical=${events.critical}, emergency=${events.emergency}`;
                                if (pressureStats.leakDetections > 0) {
                                    eventDetails += ` | leak detections: ${pressureStats.leakDetections}`;
                                }
                                if (pressureStats.emergencyActions > 0) {
                                    eventDetails += ` | emergency actions: ${pressureStats.emergencyActions}`;
                                }
                                bot.sendMessage(message.roomId, eventDetails);
                            }, 1000);
                        }
                    } else {
                        // Legacy verbose information
                        const legacyStats = stats.legacy;
                        let details = `peaks: heap ${legacyStats.peak.heapUsedMB}MB, RSS ${legacyStats.peak.rssMB}MB | `;
                        details += `avg: heap ${legacyStats.average.heapUsedMB}MB, RSS ${legacyStats.average.rssMB}MB | `;
                        details += `uptime: ${Math.floor(legacyStats.uptime / 3600)}h ${Math.floor((legacyStats.uptime % 3600) / 60)}m`;
                        
                        bot.sendMessage(message.roomId, details);
                    }
                    
                    // Show data structure sizes if any
                    const dataStructures = stats.enhanced?.pressure?.components || stats.legacy?.dataStructures || {};
                    if (Object.keys(dataStructures).length > 0) {
                        setTimeout(() => {
                            const sizes = Object.entries(dataStructures)
                                .filter(([name, size]) => size !== 'tracked' && size !== 'error')
                                .slice(0, 5) // Show only first 5 to avoid spam
                                .map(([name, size]) => `${name}: ${size}`)
                                .join(' | ');
                            if (sizes) {
                                bot.sendMessage(message.roomId, `data structures: ${sizes}`);
                            }
                        }, 2000);
                    }
                }, 1000);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Error in memory command', {
                error: error.message,
                stack: error.stack
            });
            bot.sendMessage(message.roomId, 'error getting memory stats mate');
            return { success: false, error: error.message };
        }
    }
});