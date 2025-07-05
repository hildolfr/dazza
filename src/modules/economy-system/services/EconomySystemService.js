import { HeistManager } from '../../../modules/heist/index.js';
import { VideoPayoutManager } from '../../../modules/video_payout/index.js';
import { PissingContestManager } from '../../../modules/pissing_contest/index.js';
import { CashMonitor } from '../../../utils/cashMonitor.js';

/**
 * Economy System Service
 * Coordinates all economy-related managers and functionality
 * Extracted from bot.js economy management integration
 */
class EconomySystemService {
    constructor(services, config, logger, bot) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.bot = bot; // Bot reference needed for economy managers
        this.ready = false;
        
        // Economy managers
        this.heistManager = null;
        this.videoPayoutManager = null;
        this.pissingContestManager = null;
        this.cashMonitor = null;
    }

    async initialize() {
        this.logger.info('EconomySystemService initializing...');
        
        try {
            // Get database service
            const db = this.services.get('database');
            if (!db) {
                throw new Error('Database service not available');
            }
            
            // Initialize HeistManager
            if (this.config.enableHeists) {
                this.heistManager = new HeistManager(db, this.bot);
                this.setupHeistHandlers();
                await this.heistManager.init();
                this.logger.info('HeistManager initialized');
            }
            
            // Initialize VideoPayoutManager
            if (this.config.enableVideoPayouts) {
                this.videoPayoutManager = new VideoPayoutManager(db, this.bot);
                this.setupVideoPayoutHandlers();
                await this.videoPayoutManager.init();
                this.logger.info('VideoPayoutManager initialized');
            }
            
            // Initialize PissingContestManager
            if (this.config.enablePissingContests) {
                this.pissingContestManager = new PissingContestManager(this.bot);
                this.logger.info('PissingContestManager initialized');
            }
            
            // Initialize CashMonitor
            if (this.config.enableCashMonitor) {
                this.cashMonitor = new CashMonitor(db, this.logger, this.config.cashMonitorInterval);
                this.logger.info('CashMonitor initialized');
            }
            
            this.ready = true;
            this.logger.info('EconomySystemService initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize EconomySystemService', { error: error.message });
            throw error;
        }
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
            shutdownPromises.push(this.heistManager.shutdown());
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