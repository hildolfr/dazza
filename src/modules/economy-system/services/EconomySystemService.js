import { CashMonitor } from '../../../utils/cashMonitor.js';

/**
 * Economy System Service
 * Coordinates all economy-related managers and functionality
 * Updated to work with modular architecture - uses service registry instead of direct imports
 */
class EconomySystemService {
    constructor(services, config, logger, bot) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.bot = bot; // Bot reference needed for economy managers
        this.ready = false;
        
        // Economy services (accessed via service registry)
        this.heistService = null;
        this.videoPayoutService = null;
        this.pissingContestService = null;
        this.cashMonitor = null;
        
        // Legacy managers (for backward compatibility)
        this.heistManager = null;
        this.videoPayoutManager = null;
        this.pissingContestManager = null;
    }

    async initialize() {
        this.logger.info('EconomySystemService initializing...');
        
        try {
            // Get services from the service registry instead of creating managers directly
            this.logger.info('Waiting for economy services to register...');
            
            // Wait for services to be available (they should register during module startup)
            await this.waitForServices();
            
            // Get economy services from registry
            this.heistService = this.services.get('heist');
            this.videoPayoutService = this.services.get('video-payout');
            this.pissingContestService = this.services.get('pissingContest');
            
            // Get legacy manager instances for backward compatibility
            if (this.heistService && typeof this.heistService.getManager === 'function') {
                this.heistManager = this.heistService.getManager();
                this.logger.info('HeistManager accessible via service');
            }
            
            if (this.videoPayoutService && typeof this.videoPayoutService.getManager === 'function') {
                this.videoPayoutManager = this.videoPayoutService.getManager();
                this.logger.info('VideoPayoutManager accessible via service');
            }
            
            if (this.pissingContestService && typeof this.pissingContestService.getManager === 'function') {
                this.pissingContestManager = this.pissingContestService.getManager();
                this.logger.info('PissingContestManager accessible via service');
            }
            
            // Initialize CashMonitor
            if (this.config.enableCashMonitor) {
                const db = this.services.get('database');
                if (db) {
                    this.cashMonitor = new CashMonitor(db, this.logger, this.config.cashMonitorInterval);
                    this.logger.info('CashMonitor initialized');
                }
            }
            
            this.ready = true;
            this.logger.info('EconomySystemService initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize EconomySystemService', { error: error.message });
            throw error;
        }
    }

    /**
     * Wait for economy services to be registered
     * @param {number} timeout - Maximum wait time in milliseconds
     * @returns {Promise} Resolves when services are available
     */
    async waitForServices(timeout = 10000) {
        const startTime = Date.now();
        const pollInterval = 100; // Check every 100ms
        
        while (Date.now() - startTime < timeout) {
            // Check if all required services are available
            const hasHeist = this.services.has('heist');
            const hasVideoPayout = this.services.has('video-payout');
            const hasPissingContest = this.services.has('pissingContest');
            
            if (hasHeist && hasVideoPayout && hasPissingContest) {
                this.logger.info('All economy services are now available');
                return;
            }
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        // Log what services are missing
        const missing = [];
        if (!this.services.has('heist')) missing.push('heist');
        if (!this.services.has('video-payout')) missing.push('video-payout');
        if (!this.services.has('pissingContest')) missing.push('pissingContest');
        
        this.logger.warn(`Some economy services are not available after ${timeout}ms: ${missing.join(', ')}`);
        this.logger.warn('Continuing without missing services...');
    }

    /**
     * Set up heist event handlers
     */
    setupHeistHandlers() {
        if (!this.heistManager) return;
        
        // Listen for heist events and send messages
        this.heistManager.on('announce', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
            }
        });

        this.heistManager.on('heist_start', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
            }
        });

        this.heistManager.on('heist_countdown', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
            }
        });

        this.heistManager.on('heist_failure', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
                // Show individual results
                if (data.results && Array.isArray(data.results)) {
                    data.results.forEach(result => {
                        if (result.message) {
                            this.bot.sendMessage(result.message);
                        }
                    });
                }
            }
        });

        this.heistManager.on('heist_success', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
                // Show individual results
                if (data.results && Array.isArray(data.results)) {
                    data.results.forEach(result => {
                        if (result.message) {
                            this.bot.sendMessage(result.message);
                        }
                    });
                }
            }
        });

        this.heistManager.on('payout', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
            }
        });

        this.heistManager.on('info', (data) => {
            if (this.bot && this.bot.sendMessage) {
                this.bot.sendMessage(data.message);
            }
        });

        this.heistManager.on('pm', (data) => {
            if (this.bot && this.bot.sendPM) {
                this.bot.sendPM(data.username, data.message);
            }
        });
    }

    /**
     * Set up video payout event handlers
     */
    setupVideoPayoutHandlers() {
        // Nothing to set up here - video payout works silently
        // All event handling is done through the existing handlers
    }

    /**
     * Process chat messages for all economy systems
     */
    async processMessage(message, room) {
        if (!this.ready || !message || !message.msg) {
            return;
        }

        try {
            // Notify heist manager of message activity
            if (this.heistManager) {
                await this.heistManager.handleMessage(message.username, message.msg);
            }

            // Check for pissing contest responses (yes/no)
            if (this.pissingContestManager) {
                await this.handlePissingContestMessage(message, room);
            }

        } catch (error) {
            this.logger.error('Error processing message in economy system', {
                error: error.message,
                username: message.username
            });
        }
    }

    /**
     * Handle heist-specific message processing
     */
    async handleHeistMessage(username, message) {
        if (this.heistManager) {
            try {
                await this.heistManager.handleMessage(username, message);
            } catch (error) {
                this.logger.error('Error handling heist message', {
                    error: error.message,
                    username
                });
            }
        }
    }

    /**
     * Handle video payout media change events
     */
    async handleVideoPayoutMediaChange(data) {
        if (this.videoPayoutManager) {
            try {
                await this.videoPayoutManager.handleMediaChange(data);
            } catch (error) {
                this.logger.error('Failed to handle media change for video payout', {
                    error: error.message
                });
            }
        }
    }

    /**
     * Handle pissing contest message processing
     */
    async handlePissingContestMessage(message, room) {
        if (!this.pissingContestManager) return;

        try {
            const lowerMsg = message.msg.toLowerCase().trim();
            const roomId = room?.roomId || 'fatpizza';
            const challenge = this.pissingContestManager.findChallengeForUser(message.username, roomId);

            if (challenge && (lowerMsg === 'yes' || lowerMsg === 'no')) {
                if (lowerMsg === 'yes') {
                    // User accepted the challenge
                    const result = await this.pissingContestManager.acceptChallenge(challenge.id);
                    
                    if (result.success) {
                        // Start the contest
                        if (this.bot && this.bot.sendMessage) {
                            this.bot.sendMessage(`${result.message}`);
                            
                            // Give some time for drama, then show the result
                            setTimeout(() => {
                                if (result.contest_result) {
                                    this.bot.sendMessage(result.contest_result);
                                }
                            }, 3000);
                        }
                    } else {
                        if (this.bot && this.bot.sendPM) {
                            this.bot.sendPM(message.username, result.message);
                        }
                    }
                } else if (lowerMsg === 'no') {
                    // User declined the challenge
                    const result = await this.pissingContestManager.declineChallenge(challenge.id);
                    
                    if (this.bot && this.bot.sendMessage) {
                        this.bot.sendMessage(result.message);
                    }
                }
            }

        } catch (error) {
            this.logger.error('Error handling pissing contest message', {
                error: error.message,
                username: message.username
            });
        }
    }

    /**
     * Start cash monitoring
     */
    async startCashMonitor() {
        if (this.cashMonitor && this.config.enableCashMonitor) {
            try {
                await this.cashMonitor.start();
                this.logger.info('Cash monitor started');
            } catch (error) {
                this.logger.error('Failed to start cash monitor', {
                    error: error.message
                });
            }
        }
    }

    /**
     * Stop cash monitoring
     */
    async stopCashMonitor() {
        if (this.cashMonitor) {
            try {
                this.cashMonitor.stop();
                this.logger.info('Cash monitor stopped');
            } catch (error) {
                this.logger.error('Failed to stop cash monitor', {
                    error: error.message
                });
            }
        }
    }

    /**
     * Get heist manager instance
     */
    getHeistManager() {
        return this.heistManager;
    }

    /**
     * Get video payout manager instance
     */
    getVideoPayoutManager() {
        return this.videoPayoutManager;
    }

    /**
     * Get pissing contest manager instance
     */
    getPissingContestManager() {
        return this.pissingContestManager;
    }

    /**
     * Get cash monitor instance
     */
    getCashMonitor() {
        return this.cashMonitor;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            ready: this.ready,
            name: 'EconomySystemService',
            managers: {
                heist: {
                    enabled: !!this.heistManager,
                    status: this.heistManager ? 'running' : 'disabled'
                },
                videoPayout: {
                    enabled: !!this.videoPayoutManager,
                    status: this.videoPayoutManager ? 'running' : 'disabled'
                },
                pissingContest: {
                    enabled: !!this.pissingContestManager,
                    status: this.pissingContestManager ? 'running' : 'disabled'
                },
                cashMonitor: {
                    enabled: !!this.cashMonitor,
                    status: this.cashMonitor ? 'running' : 'disabled'
                }
            },
            config: this.config
        };
    }

    /**
     * Clean up all economy managers
     */
    async destroy() {
        this.logger.info('EconomySystemService destroying...');
        
        // Stop cash monitor first
        if (this.cashMonitor) {
            this.cashMonitor.stop();
        }

        // Shutdown managers in parallel
        const shutdownPromises = [];

        if (this.heistManager) {
            shutdownPromises.push(this.heistManager.stop());
        }

        if (this.videoPayoutManager) {
            shutdownPromises.push(this.videoPayoutManager.shutdown());
        }

        // Wait for all managers to shutdown
        await Promise.all(shutdownPromises);
        
        // Reset all references
        this.heistManager = null;
        this.videoPayoutManager = null;
        this.pissingContestManager = null;
        this.cashMonitor = null;
        this.ready = false;
        
        this.logger.info('EconomySystemService destroyed');
    }
}

export default EconomySystemService;