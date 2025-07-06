import { Command } from '../base.js';

export default new Command({
    name: 'emergency-memory',
    aliases: ['emem', 'memory-emergency'],
    description: 'Emergency memory management commands for critical situations',
    usage: '!emergency-memory <action> [level] - Actions: cleanup, gc, status, reset, shutdown-protection',
    category: 'admin',
    users: ['hildolfr'],
    cooldown: 10000, // 10 second cooldown for safety
    
    async handler(bot, message, args) {
        try {
            const memoryService = bot.services?.get('memoryManagement');
            
            if (!memoryService) {
                bot.sendMessage(message.roomId, 'memory management service not available mate');
                return { success: true };
            }
            
            const action = args[0]?.toLowerCase();
            
            if (!action) {
                bot.sendMessage(message.roomId, 'usage: !emergency-memory <action> [level] - actions: cleanup, gc, status, reset, shutdown-protection');
                return { success: true };
            }
            
            switch (action) {
                case 'cleanup':
                    return await this.handleCleanup(bot, message, args, memoryService);
                    
                case 'gc':
                    return await this.handleGC(bot, message, args, memoryService);
                    
                case 'status':
                    return await this.handleStatus(bot, message, args, memoryService);
                    
                case 'reset':
                    return await this.handleReset(bot, message, args, memoryService);
                    
                case 'shutdown-protection':
                case 'protection':
                    return await this.handleShutdownProtection(bot, message, args, memoryService);
                    
                default:
                    bot.sendMessage(message.roomId, `unknown action: ${action} - available: cleanup, gc, status, reset, shutdown-protection`);
                    return { success: true };
            }
            
        } catch (error) {
            bot.logger.error('Error in emergency memory command', {
                error: error.message,
                stack: error.stack
            });
            bot.sendMessage(message.roomId, 'error executing emergency memory command mate');
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Handle cleanup action
     */
    async handleCleanup(bot, message, args, memoryService) {
        const level = args[1]?.toLowerCase() || 'moderate';
        const validLevels = ['gentle', 'moderate', 'aggressive', 'emergency'];
        
        if (!validLevels.includes(level)) {
            bot.sendMessage(message.roomId, `invalid cleanup level: ${level} - valid: ${validLevels.join(', ')}`);
            return { success: true };
        }
        
        bot.sendMessage(message.roomId, `starting ${level} memory cleanup...`);
        
        try {
            const result = await memoryService.forceCleanup(level);
            
            if (result.success) {
                let response = `${level} cleanup completed`;
                
                if (result.memoryFreed !== undefined) {
                    const freedMB = Math.round(result.memoryFreed / 1024 / 1024);
                    response += ` - freed ${freedMB}MB`;
                }
                
                if (result.duration) {
                    response += ` in ${result.duration}ms`;
                }
                
                if (result.actions && result.actions.length > 0) {
                    response += ` - ${result.actions.length} actions executed`;
                }
                
                bot.sendMessage(message.roomId, response);
                
                if (result.errors && result.errors.length > 0) {
                    setTimeout(() => {
                        bot.sendMessage(message.roomId, `cleanup warnings: ${result.errors.length} errors occurred`);
                    }, 1000);
                }
            } else {
                bot.sendMessage(message.roomId, `cleanup failed: ${result.reason || 'unknown error'}`);
            }
            
        } catch (error) {
            bot.logger.error('Error during emergency cleanup', { error: error.message });
            bot.sendMessage(message.roomId, `cleanup failed: ${error.message}`);
        }
        
        return { success: true };
    },
    
    /**
     * Handle garbage collection action
     */
    async handleGC(bot, message, args, memoryService) {
        const cycles = parseInt(args[1]) || 1;
        
        if (cycles < 1 || cycles > 5) {
            bot.sendMessage(message.roomId, 'gc cycles must be between 1 and 5');
            return { success: true };
        }
        
        bot.sendMessage(message.roomId, `forcing ${cycles} garbage collection cycle${cycles > 1 ? 's' : ''}...`);
        
        try {
            let totalFreed = 0;
            let successCount = 0;
            
            for (let i = 0; i < cycles; i++) {
                const result = memoryService.forceGC();
                
                if (result.success) {
                    successCount++;
                    if (result.freed !== undefined) {
                        totalFreed += result.freed;
                    }
                }
                
                // Small delay between cycles
                if (i < cycles - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            if (successCount > 0) {
                let response = `completed ${successCount}/${cycles} GC cycles`;
                if (totalFreed > 0) {
                    response += ` - freed ${totalFreed}MB total`;
                }
                bot.sendMessage(message.roomId, response);
            } else {
                bot.sendMessage(message.roomId, 'garbage collection not available (need --expose-gc flag)');
            }
            
        } catch (error) {
            bot.logger.error('Error during emergency GC', { error: error.message });
            bot.sendMessage(message.roomId, `gc failed: ${error.message}`);
        }
        
        return { success: true };
    },
    
    /**
     * Handle status action
     */
    async handleStatus(bot, message, args, memoryService) {
        try {
            const stats = memoryService.getMemoryStats();
            
            if (stats.enhanced) {
                const system = stats.enhanced.system;
                const pressure = stats.enhanced.pressure;
                
                let response = `memory system status: ${system.isMonitoring ? 'monitoring' : 'stopped'} | `;
                response += `pressure: ${system.currentPressureLevel} | `;
                response += `emergency mode: ${system.emergencyMode ? 'YES' : 'no'}`;
                
                bot.sendMessage(message.roomId, response);
                
                setTimeout(() => {
                    const systemStats = stats.enhanced.stats;
                    let details = `alerts: ${systemStats.totalAlerts} | `;
                    details += `cleanups: ${systemStats.totalCleanups} | `;
                    details += `emergency actions: ${systemStats.emergencyActions}`;
                    
                    if (systemStats.componentShutdowns > 0) {
                        details += ` | shutdowns: ${systemStats.componentShutdowns}`;
                    }
                    
                    bot.sendMessage(message.roomId, details);
                }, 1000);
                
                // Show shutdown protection status
                if (stats.enhanced.shutdownProtection) {
                    setTimeout(() => {
                        const protection = stats.enhanced.shutdownProtection;
                        let protectionStatus = `shutdown protection: ${protection.enabled ? 'enabled' : 'disabled'} | `;
                        protectionStatus += `attempts: ${protection.attempts}/${protection.maxAttempts}`;
                        
                        if (protection.lastAttempt) {
                            const lastAttempt = new Date(protection.lastAttempt);
                            protectionStatus += ` | last: ${lastAttempt.toLocaleTimeString()}`;
                        }
                        
                        bot.sendMessage(message.roomId, protectionStatus);
                    }, 2000);
                }
                
            } else {
                bot.sendMessage(message.roomId, 'enhanced memory monitoring not available - using legacy stats');
                
                if (stats.legacy) {
                    let response = `legacy memory status: ${stats.legacy.trend} trend | `;
                    response += `heap: ${stats.legacy.current.heapPercent}% | `;
                    response += `GC: ${stats.legacy.gc.count} times`;
                    
                    bot.sendMessage(message.roomId, response);
                }
            }
            
        } catch (error) {
            bot.logger.error('Error getting emergency memory status', { error: error.message });
            bot.sendMessage(message.roomId, `status failed: ${error.message}`);
        }
        
        return { success: true };
    },
    
    /**
     * Handle reset action
     */
    async handleReset(bot, message, args, memoryService) {
        const confirmFlag = args[1]?.toLowerCase();
        
        if (confirmFlag !== '--confirm') {
            bot.sendMessage(message.roomId, 'this will reset memory monitoring stats - use --confirm to proceed');
            return { success: true };
        }
        
        bot.sendMessage(message.roomId, 'resetting memory monitoring system...');
        
        try {
            // This would require implementing a reset method
            const status = memoryService.getStatus();
            
            if (status.hasEnhancedMonitoring) {
                bot.sendMessage(message.roomId, 'enhanced memory system reset not implemented yet - restart bot for full reset');
            } else {
                bot.sendMessage(message.roomId, 'legacy memory system - restart bot for reset');
            }
            
        } catch (error) {
            bot.logger.error('Error during memory reset', { error: error.message });
            bot.sendMessage(message.roomId, `reset failed: ${error.message}`);
        }
        
        return { success: true };
    },
    
    /**
     * Handle shutdown protection action
     */
    async handleShutdownProtection(bot, message, args, memoryService) {
        const action = args[1]?.toLowerCase();
        
        if (!action || !['enable', 'disable', 'status'].includes(action)) {
            bot.sendMessage(message.roomId, 'usage: !emergency-memory shutdown-protection <enable|disable|status>');
            return { success: true };
        }
        
        try {
            const stats = memoryService.getMemoryStats();
            
            if (!stats.enhanced) {
                bot.sendMessage(message.roomId, 'shutdown protection only available with enhanced memory monitoring');
                return { success: true };
            }
            
            const protection = stats.enhanced.shutdownProtection;
            
            if (action === 'status') {
                let response = `shutdown protection: ${protection.enabled ? 'enabled' : 'disabled'} | `;
                response += `threshold: ${Math.round(protection.threshold * 100)}% | `;
                response += `attempts: ${protection.attempts}/${protection.maxAttempts}`;
                
                bot.sendMessage(message.roomId, response);
                
                if (protection.lastAttempt) {
                    setTimeout(() => {
                        const lastAttempt = new Date(protection.lastAttempt);
                        const timeSince = Math.round((Date.now() - Date.parse(protection.lastAttempt)) / 1000 / 60);
                        bot.sendMessage(message.roomId, `last attempt: ${lastAttempt.toLocaleString()} (${timeSince} minutes ago)`);
                    }, 1000);
                }
            } else {
                // Note: Actual enable/disable would require implementing these methods
                bot.sendMessage(message.roomId, `shutdown protection ${action} not implemented - modify config to change setting`);
            }
            
        } catch (error) {
            bot.logger.error('Error handling shutdown protection', { error: error.message });
            bot.sendMessage(message.roomId, `shutdown protection failed: ${error.message}`);
        }
        
        return { success: true };
    }
});