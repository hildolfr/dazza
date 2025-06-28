export class Command {
    constructor(options) {
        this.name = options.name;
        this.aliases = options.aliases || [];
        this.description = options.description;
        this.usage = options.usage;
        this.cooldown = options.cooldown || 5000;
        this.category = options.category || 'misc';
        this.enabled = options.enabled !== false;
        this.adminOnly = options.adminOnly || false;
        this.users = options.users || null; // Array of allowed usernames or null for all
        this.pmAccepted = options.pmAccepted || false; // Can this command be invoked via PM
        this.pmResponses = options.pmResponses || false; // Should responses go to PM instead of chat
        this.handler = options.handler;
    }

    async execute(bot, message, args) {
        if (!this.enabled) {
            return { success: false, error: 'nah that command\'s fucked mate, turned off' };
        }

        if (this.adminOnly && !bot.isAdmin(message.username)) {
            return { success: false, error: 'piss off mate, that\'s for the big dogs only' };
        }

        // Check user-specific permissions (no admin bypass)
        if (this.users) {
            // Check if 'all' is in the users array
            const allowedToAll = this.users.some(u => u.toLowerCase() === 'all');
            if (!allowedToAll) {
                // Check if 'Admin' is in the users array and user is admin
                const allowedToAdmins = this.users.some(u => u.toLowerCase() === 'admin');
                const isUserAdmin = bot.isAdmin(message.username);
                
                if (allowedToAdmins && isUserAdmin) {
                    // User is admin and command allows admins
                    // Continue execution
                } else {
                    // Case-insensitive username check
                    const usernameLower = message.username.toLowerCase();
                    const allowed = this.users.some(u => u.toLowerCase() === usernameLower);
                    if (!allowed) {
                        // Silently ignore - no error message
                        return { success: false };
                    }
                }
            }
        }

        try {
            return await this.handler(bot, message, args);
        } catch (error) {
            console.error(`Error in command ${this.name}:`, error);
            return { success: false, error: 'ah shit somethin went wrong there' };
        }
    }
}