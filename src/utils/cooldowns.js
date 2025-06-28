export class CooldownManager {
    constructor() {
        this.cooldowns = new Map();
    }

    check(key, duration) {
        const now = Date.now();
        const lastUsed = this.cooldowns.get(key);
        
        if (lastUsed && (now - lastUsed) < duration) {
            const remaining = Math.ceil((duration - (now - lastUsed)) / 1000);
            return { allowed: false, remaining };
        }
        
        this.cooldowns.set(key, now);
        return { allowed: true };
    }

    reset(key) {
        this.cooldowns.delete(key);
    }

    clear() {
        this.cooldowns.clear();
    }
}