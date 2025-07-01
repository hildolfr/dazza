import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');

dotenv.config({ path: path.join(rootDir, '.env') });

function loadCredentials() {
    try {
        const credentialsPath = path.join(rootDir, 'login.txt');
        const content = fs.readFileSync(credentialsPath, 'utf8');
        const credentials = {};
        
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                credentials[key.trim()] = value.trim();
            }
        });
        
        return credentials;
    } catch (error) {
        console.error('Failed to load credentials:', error.message);
        return {};
    }
}

const credentials = loadCredentials();

export default {
    bot: {
        name: process.env.BOT_NAME || 'CyTubeBot',
        username: credentials.username || process.env.BOT_USERNAME,
        password: credentials.password || process.env.BOT_PASSWORD,
    },
    cytube: {
        url: process.env.CYTUBE_URL || 'https://cytu.be',
        channel: process.env.CHANNEL_NAME || 'fatpizza',
    },
    database: {
        path: path.join(rootDir, 'cytube_stats.db'),
    },
    cooldowns: {
        default: 5000,
        bong: 10000,
        tell: 3000,
    },
    greeting: {
        enabled: true,
        cooldown: 12 * 60 * 60 * 1000, // 12 hours
    },
    reminder: {
        checkInterval: 60 * 1000, // 1 minute
        maxDuration: 24 * 60 * 60 * 1000, // 24 hours
    },
    admins: ['ilovechinks', 'hildolfr', 'Spazztik'], // Channel admins
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        console: process.env.LOG_CONSOLE !== 'false'
    },
    ollama: {
        url: process.env.OLLAMA_URL || 'http://192.168.68.85:11434',
        model: process.env.OLLAMA_MODEL || 'dolphin-mistral:7b-v2.8-q4_0',
        timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000, // Increased to 30 seconds
        enabled: process.env.OLLAMA_ENABLED !== 'false' // Default to enabled
    },
    heist: {
        minHeistDelay: 2 * 60 * 60 * 1000,    // 2 hours minimum between heists
        maxHeistDelay: 20 * 60 * 60 * 1000,   // 20 hours maximum between heists
        votingDuration: 3 * 60 * 1000,         // 3 minutes to vote
        heistDuration: 5 * 60 * 1000,          // 5 minutes for heist execution
        cooldownDuration: 30 * 1000,           // 30 seconds cooldown after heist
        activityCheckPeriod: 5 * 60 * 1000,    // Check last 5 minutes of activity
        minActiveUsers: 2,                     // Need at least 2 users active
        minMessages: 5,                        // Need at least 5 messages in period
        startingBalance: 1000,                 // New users start with $1000
        startingTrust: 50                      // New users start with 50 trust
    },
    api: {
        enabled: true,
        port: 3001
    }
};