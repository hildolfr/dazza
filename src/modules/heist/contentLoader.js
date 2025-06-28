import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('HeistContent');

class HeistContentLoader {
    constructor() {
        this.content = {
            crimes: null,
            announcements: null,
            departure: null,
            outcomes: null,
            payout: null
        };
        this.loaded = false;
    }

    async loadContent() {
        if (this.loaded) return;

        try {
            const contentDir = join(__dirname, 'content');
            
            // Load all JSON files
            this.content.crimes = await this.loadJSON(join(contentDir, 'crimes.json'));
            this.content.announcements = await this.loadJSON(join(contentDir, 'announcements.json'));
            this.content.departure = await this.loadJSON(join(contentDir, 'departure.json'));
            this.content.outcomes = await this.loadJSON(join(contentDir, 'outcomes.json'));
            this.content.payout = await this.loadJSON(join(contentDir, 'payout.json'));
            
            this.loaded = true;
            logger.info('Heist content loaded successfully');
        } catch (error) {
            logger.error('Failed to load heist content:', error);
            throw new Error('Failed to load heist content files');
        }
    }

    async loadJSON(filepath) {
        try {
            const data = await readFile(filepath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error(`Failed to load ${filepath}:`, error);
            throw error;
        }
    }

    // Get a random item from an array
    getRandom(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // Get all crimes
    getCrimes() {
        return this.content.crimes?.crimes || [];
    }

    // Get crime by ID
    getCrimeById(id) {
        return this.getCrimes().find(crime => crime.id === id);
    }

    // Get random announcement based on context
    getAnnouncement(context = 'standard') {
        const announcements = this.content.announcements?.announcements;
        if (!announcements) return null;
        
        // Try to get context-specific announcement, fall back to standard
        const contextMessages = announcements[context] || announcements.standard;
        return this.getRandom(contextMessages);
    }

    // Get departure message based on context
    getDeparture(context = 'standard') {
        const departures = this.content.departure?.departure;
        if (!departures) return null;
        
        const contextMessages = departures[context] || departures.standard;
        return this.getRandom(contextMessages);
    }

    // Get outcome message based on success and haul size
    getOutcome(success, haul, crime, isSolo = false) {
        const outcomes = this.content.outcomes?.outcomes;
        if (!outcomes) return null;

        let category = 'standard';
        let messagePool;

        if (success) {
            if (isSolo) {
                category = 'solo_success';
            } else if (haul > 1000) {
                category = 'big_haul';
            } else if (haul < 50) {
                category = 'small_haul';
            } else if (Math.random() < 0.1) {
                category = 'lucky';
            } else if (Math.random() < 0.1) {
                category = 'perfect';
            }
            messagePool = outcomes.success[category] || outcomes.success.standard;
        } else {
            if (isSolo) {
                category = 'solo_failure';
            } else if (Math.random() < 0.2) {
                category = 'caught';
            } else if (Math.random() < 0.2) {
                category = 'bad_luck';
            } else if (Math.random() < 0.1) {
                category = 'comedic';
            } else if (Math.random() < 0.1) {
                category = 'equipment_failure';
            }
            messagePool = outcomes.failure[category] || outcomes.failure.standard;
        }

        let message = this.getRandom(messagePool);
        
        // Replace placeholders
        message = message.replace('{crime}', crime.name);
        message = message.replace('${haul}', `$${haul}`);
        
        return message;
    }

    // Get payout message
    getPayoutMessage(distributions, totalAmount, isSolo = false) {
        const payouts = this.content.payout?.payout;
        if (!payouts) return null;

        let category = 'standard';
        
        // Check for special cases
        if (isSolo && distributions.length === 1) {
            category = 'solo_payout';
        } else if (distributions.some(d => d.offline)) {
            category = 'with_offline_penalty';
        } else if (distributions.some(d => d.savedFromOffline)) {
            category = 'with_offline_penalty';
        } else if (distributions.some(d => d.username === 'dazza') && Math.random() < 0.3) {
            category = 'with_dazza_cut';
        } else if (totalAmount > 1000) {
            category = 'big_payout';
        } else if (totalAmount < 100) {
            category = 'small_payout';
        } else if (distributions.some(d => d.trustGained > 0) && Math.random() < 0.3) {
            category = 'trust_bonus';
        }

        const messagePool = payouts[category] || payouts.standard;
        return this.getRandom(messagePool);
    }

    // Format payout distributions for display
    formatDistributions(distributions) {
        const topEarners = distributions
            .filter(d => d.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3);

        const formatted = topEarners.map(e => {
            let msg = `-${e.username} got $${e.amount}`;
            
            // Add offline penalty notice
            if (e.offline) {
                msg += ` (reduced - logged out)`;
            }
            
            // Add saved money notice for Dazza
            if (e.savedFromOffline) {
                msg += ` (including $${e.savedFromOffline} from lazy cunts who logged out)`;
            }
            
            if (e.trustGained > 0) {
                msg += ` (+${e.trustGained} trust)`;
            } else if (e.trustGained < 0) {
                msg += ` (${e.trustGained} trust)`;
            }
            return msg;
        });

        const remaining = distributions.length - topEarners.length;
        if (remaining > 0) {
            const offlineCount = distributions.filter(d => d.offline && d.amount === 0).length;
            if (offlineCount > 0) {
                formatted.push(`and ${remaining} others (${offlineCount} got nothing - logged out)`);
            } else {
                formatted.push(`and ${remaining} others`);
            }
        }

        return formatted.join(', ');
    }

    // Get payout comment for specific user
    getPayoutComment(username, amount, trust, savedFromOffline = 0) {
        const comments = this.content.payout?.payout_comments;
        if (!comments || Math.random() > 0.3) return null; // Only comment 30% of the time

        let category = 'big_earner';
        
        // Special handling for Dazza
        if (username === 'dazza') {
            if (savedFromOffline > 0) {
                category = 'dazza_offline_bonus';
            } else {
                category = 'dazza_profit';
            }
        } else if (trust === 0) {
            category = 'first_timer';
        } else if (trust > 50) {
            category = 'trusted_veteran';
        }

        const commentPool = comments[category];
        if (!commentPool) return null;

        let comment = this.getRandom(commentPool);
        return comment.replace('{username}', username);
    }

    // Get time-based announcement context
    getTimeContext() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 22 || hour < 5) return 'night';
        if (Math.random() < 0.1) return 'drunk';
        if (Math.random() < 0.1) return 'desperate';
        if (Math.random() < 0.1) return 'confident';
        return 'standard';
    }
}

// Export singleton instance
export const contentLoader = new HeistContentLoader();