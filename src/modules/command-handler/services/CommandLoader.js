const fs = require('fs').promises;
const path = require('path');
const CommandRegistry = require('./CommandRegistry');

class CommandLoader {
    constructor(logger = null) {
        this.logger = logger || console;
        this.registry = new CommandRegistry(this.logger);
    }

    async loadCommands(commandsPath = null) {
        // Default to the existing commands path
        const basePath = commandsPath || path.join(__dirname, '../../../commands');
        const categories = ['basic', 'fun', 'utility', 'stats', 'communication', 'economy', 'admin'];
        
        for (const category of categories) {
            const categoryPath = path.join(basePath, category);
            
            try {
                const files = await fs.readdir(categoryPath);
                
                for (const file of files) {
                    if (!file.endsWith('.js')) continue;
                    
                    try {
                        const commandPath = path.join(categoryPath, file);
                        
                        // Clear module cache to allow hot reloading
                        delete require.cache[require.resolve(commandPath)];
                        
                        const commandModule = require(commandPath);
                        let command = commandModule.default || commandModule;
                        
                        // Handle ES6 modules that were imported as CommonJS
                        if (command && typeof command === 'object' && command.default) {
                            command = command.default;
                        }
                        
                        if (command) {
                            this.registry.register(command);
                        }
                    } catch (error) {
                        this.logger.error(`Failed to load command ${file}:`, error);
                    }
                }
            } catch (error) {
                // Category directory might not exist yet
                this.logger.debug(`No commands found in category: ${category}`);
            }
        }
        
        this.logger.info(`Loaded ${this.registry.getAll().length} commands`);
        return this.registry;
    }

    async reloadCommand(commandName) {
        const command = this.registry.get(commandName);
        if (!command) {
            return false;
        }

        const category = command.category;
        const commandPath = path.join(__dirname, '../../../commands', category, `${commandName}.js`);
        
        try {
            // Clear module cache
            delete require.cache[require.resolve(commandPath)];
            
            // Unregister old command
            this.registry.unregister(commandName);
            
            // Load new command
            const commandModule = require(commandPath);
            let newCommand = commandModule.default || commandModule;
            
            // Handle ES6 modules that were imported as CommonJS
            if (newCommand && typeof newCommand === 'object' && newCommand.default) {
                newCommand = newCommand.default;
            }
            
            if (newCommand) {
                this.registry.register(newCommand);
                this.logger.info(`Reloaded command: ${commandName}`);
                return true;
            }
        } catch (error) {
            this.logger.error(`Failed to reload command ${commandName}:`, error);
        }
        
        return false;
    }

    async reloadAllCommands() {
        // Clear all commands
        this.registry.commands.clear();
        this.registry.aliases.clear();
        this.registry.categories.clear();
        
        // Reload all commands
        return await this.loadCommands();
    }

    getRegistry() {
        return this.registry;
    }
}

module.exports = CommandLoader;