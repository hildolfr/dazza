/**
 * Reminder Service
 * Handles automated reminder delivery with periodic checking
 * Extracted from bot.js reminder functionality
 */
class ReminderService {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
        this.intervalId = null;
        this.userlist = null;
        this.room = null;
    }

    async initialize() {
        this.logger.info('ReminderService initializing...');
        this.ready = true;
        this.logger.info('ReminderService initialized');
    }

    /**
     * Start the periodic reminder checking
     * @param {Object} userlist - Reference to userlist for checking online users
     * @param {Object} room - Room context for sending messages
     */
    start(userlist, room) {
        this.userlist = userlist;
        this.room = room;
        
        if (this.intervalId) {
            this.logger.warn('Reminder service already started');
            return;
        }

        this.intervalId = setInterval(() => {
            this.checkReminders();
        }, this.config.checkInterval);

        this.logger.info(`Reminder service started with ${this.config.checkInterval}ms interval`);
    }

    /**
     * Stop the periodic reminder checking
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logger.info('Reminder service stopped');
        }
    }

    /**
     * Check for due reminders and deliver them
     * Core logic extracted from bot.js lines 1510-1586
     */
    async checkReminders() {
        try {
            const db = this.services.get('database');
            if (!db) {
                this.logger.error('Database service not available for reminder delivery');
                return;
            }

            const reminders = await db.getDueReminders();
            
            for (const reminder of reminders) {
                let delivered = false;
                
                if (reminder.to_user === '@me') {
                    // Always deliver self-reminders
                    this.deliverSelfReminder(reminder);
                    delivered = true;
                } else {
                    // Check if target user is online
                    const user = this.userlist && this.userlist.get(reminder.to_user.toLowerCase());
                    if (user) {
                        // Calculate how late the reminder is
                        const now = Date.now();
                        const lateness = now - reminder.remind_at;
                        
                        // If more than 1 minute late, mention it
                        if (lateness > 60000) {
                            this.deliverLateReminder(reminder, lateness);
                        } else {
                            this.deliverOnTimeReminder(reminder);
                        }
                        delivered = true;
                    } else {
                        // User is offline, keep checking until they come online
                        this.logger.debug(`Reminder for offline user ${reminder.to_user}, will retry later`);
                    }
                }
                
                // Only mark as delivered if actually sent
                if (delivered) {
                    await db.markReminderDelivered(reminder.id);
                }
            }
        } catch (error) {
            this.logger.error('Failed to check reminders', { error: error.message });
        }
    }

    /**
     * Deliver a self-reminder (@me)
     * @param {Object} reminder - The reminder object from database
     */
    deliverSelfReminder(reminder) {
        const selfDeliveries = [
            `oi -${reminder.from_user} ya wanted me to remind ya: ${reminder.message}`,
            `-${reminder.from_user} mate, reminder time: ${reminder.message}`,
            `ey -${reminder.from_user}, you told me to bug ya about this: ${reminder.message}`,
            `*taps -${reminder.from_user} on shoulder* time for: ${reminder.message}`,
            `WAKE UP -${reminder.from_user}! ${reminder.message}`,
            `reminder for -${reminder.from_user}: ${reminder.message}`,
            `-${reminder.from_user}! oi! ${reminder.message}`,
            `this is your reminder -${reminder.from_user}: ${reminder.message}`
        ];
        
        const message = selfDeliveries[Math.floor(Math.random() * selfDeliveries.length)];
        this.sendMessage(message);
    }

    /**
     * Deliver a late reminder (more than 1 minute late)
     * @param {Object} reminder - The reminder object from database
     * @param {number} lateness - How late the reminder is in milliseconds
     */
    deliverLateReminder(reminder, lateness) {
        const lateMinutes = Math.floor(lateness / 60000);
        const lateHours = Math.floor(lateMinutes / 60);
        
        let lateText;
        if (lateHours > 0) {
            lateText = `${lateHours}h ${lateMinutes % 60}m late`;
        } else {
            lateText = `${lateMinutes}m late`;
        }
        
        const lateDeliveries = [
            `-${reminder.to_user} oi listen up, -${reminder.from_user} wanted me to tell ya: ${reminder.message} (sorry mate, ${lateText} - you were offline)`,
            `finally caught ya -${reminder.to_user}! -${reminder.from_user} wanted me to tell ya: ${reminder.message} (${lateText} late, where were ya?)`,
            `-${reminder.to_user}! about bloody time! -${reminder.from_user} said: ${reminder.message} (${lateText} ago)`,
            `ey -${reminder.to_user}, got a late message from -${reminder.from_user}: ${reminder.message} (supposed to be ${lateText} ago)`,
            `-${reminder.to_user} ya finally showed up! -${reminder.from_user} wanted ya to know: ${reminder.message} (${lateText} late)`
        ];
        
        const message = lateDeliveries[Math.floor(Math.random() * lateDeliveries.length)];
        this.sendMessage(message);
    }

    /**
     * Deliver an on-time reminder
     * @param {Object} reminder - The reminder object from database
     */
    deliverOnTimeReminder(reminder) {
        const onTimeDeliveries = [
            `-${reminder.to_user} oi listen up, -${reminder.from_user} wanted me to tell ya: ${reminder.message}`,
            `message for -${reminder.to_user} from -${reminder.from_user}: ${reminder.message}`,
            `ey -${reminder.to_user}! -${reminder.from_user} says: ${reminder.message}`,
            `-${reminder.to_user} mate, -${reminder.from_user} told me to remind ya: ${reminder.message}`,
            `*pokes -${reminder.to_user}* message from -${reminder.from_user}: ${reminder.message}`,
            `attention -${reminder.to_user}! -${reminder.from_user} wants ya to know: ${reminder.message}`,
            `-${reminder.to_user}, got something for ya from -${reminder.from_user}: ${reminder.message}`
        ];
        
        const message = onTimeDeliveries[Math.floor(Math.random() * onTimeDeliveries.length)];
        this.sendMessage(message);
    }

    /**
     * Send a message to the room
     * @param {string} message - Message to send
     */
    sendMessage(message) {
        try {
            if (this.room && this.room.sendMessage) {
                this.room.sendMessage(message);
            } else {
                this.logger.warn('No room context available for sending reminder message');
            }
        } catch (error) {
            this.logger.error('Failed to send reminder message', { error: error.message, message });
        }
    }

    /**
     * Get service status
     * @returns {Object} - Service status information
     */
    getStatus() {
        return {
            ready: this.ready,
            name: 'ReminderService',
            running: !!this.intervalId,
            checkInterval: this.config.checkInterval
        };
    }
}

export default ReminderService;