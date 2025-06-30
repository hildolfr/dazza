import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../');

class GitService {
    constructor() {
        this.gitConfig = {
            name: 'hildolfr',
            email: 'svhildolfr@gmail.com'
        };
        this.isConfigured = false;
    }

    async ensureGitConfig() {
        if (this.isConfigured) return;

        try {
            await execAsync(`git config user.name "${this.gitConfig.name}"`, { cwd: PROJECT_ROOT });
            await execAsync(`git config user.email "${this.gitConfig.email}"`, { cwd: PROJECT_ROOT });
            this.isConfigured = true;
        } catch (error) {
            console.error('Failed to configure Git:', error);
            throw error;
        }
    }

    async add(files) {
        await this.ensureGitConfig();
        const filesStr = Array.isArray(files) ? files.join(' ') : files;
        
        try {
            const { stdout, stderr } = await execAsync(`git add ${filesStr}`, { cwd: PROJECT_ROOT });
            return { success: true, stdout, stderr };
        } catch (error) {
            // Suppress console error, return failure silently
            return { success: false, error: error.message };
        }
    }

    async commit(message) {
        await this.ensureGitConfig();
        
        try {
            const { stdout, stderr } = await execAsync(
                `git commit -m "${message.replace(/"/g, '\\"')}"`, 
                { cwd: PROJECT_ROOT }
            );
            return { success: true, stdout, stderr };
        } catch (error) {
            if (error.stdout && error.stdout.includes('nothing to commit')) {
                return { success: true, nothingToCommit: true };
            }
            // Suppress console error, return failure silently
            return { success: false, error: error.message };
        }
    }

    async push(branch = 'main') {
        await this.ensureGitConfig();
        
        try {
            const { stdout, stderr } = await execAsync(`git push origin ${branch}`, { cwd: PROJECT_ROOT });
            return { success: true, stdout, stderr };
        } catch (error) {
            // Suppress console error, return failure silently
            return { success: false, error: error.message };
        }
    }

    async status() {
        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: PROJECT_ROOT });
            return { success: true, files: stdout.trim().split('\n').filter(line => line) };
        } catch (error) {
            // Suppress console error, return failure silently
            return { success: false, error: error.message };
        }
    }

    async commitAndPush(files, message, branch = 'main') {
        const addResult = await this.add(files);
        if (!addResult.success) return addResult;

        const commitResult = await this.commit(message);
        if (!commitResult.success) return commitResult;
        
        if (commitResult.nothingToCommit) {
            return { success: true, nothingToCommit: true };
        }

        const pushResult = await this.push(branch);
        return pushResult;
    }
}

export default new GitService();