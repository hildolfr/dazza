import { CommandRegistry } from './registry.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands(logger = null) {
    const registry = new CommandRegistry(logger);
    const categories = ['basic', 'fun', 'utility', 'stats', 'communication', 'economy', 'admin'];
    
    // Use console as fallback if no logger provided
    const log = logger || console;
    
    for (const category of categories) {
        const categoryPath = path.join(__dirname, category);
        
        try {
            const files = await fs.readdir(categoryPath);
            
            for (const file of files) {
                if (!file.endsWith('.js')) continue;
                
                try {
                    const commandModule = await import(path.join(categoryPath, file));
                    const command = commandModule.default;
                    
                    if (command) {
                        registry.register(command);
                    }
                } catch (error) {
                    log.error(`Failed to load command ${file}:`, error);
                }
            }
        } catch (error) {
            // Category directory might not exist yet
            log.debug(`No commands found in category: ${category}`);
        }
    }
    
    log.info(`Loaded ${registry.getAll().length} commands`);
    return registry;
}

export { CommandRegistry } from './registry.js';
export { Command } from './base.js';