import { CommandRegistry } from './registry.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands() {
    const registry = new CommandRegistry();
    const categories = ['basic', 'fun', 'utility', 'stats', 'communication', 'economy', 'admin'];
    
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
                    console.error(`Failed to load command ${file}:`, error);
                }
            }
        } catch (error) {
            // Category directory might not exist yet
            console.log(`No commands found in category: ${category}`);
        }
    }
    
    console.log(`Loaded ${registry.getAll().length} commands`);
    return registry;
}

export { CommandRegistry } from './registry.js';
export { Command } from './base.js';