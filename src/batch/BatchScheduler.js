import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

class BatchScheduler extends EventEmitter {
    constructor(db, logger) {
        super();
        this.db = db;
        this.logger = logger;
        this.jobs = new Map();
        this.intervals = new Map();
        this.timeouts = new Map(); // Track timeouts for cleanup
        this.isRunning = false;
        this.isShuttingDown = false;
        this.stateFile = path.join(process.cwd(), 'data', 'batch_state.json');
        
        // Bind cleanup for emergency shutdown
        this.boundCleanup = this.cleanup.bind(this);
        process.on('SIGINT', this.boundCleanup);
        process.on('SIGTERM', this.boundCleanup);
    }

    async init() {
        await this.createBatchTables();
        await this.loadState();
        this.isRunning = true;
        this.logger.info('Batch scheduler initialized');
    }

    async createBatchTables() {
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS batch_jobs (
                job_name TEXT PRIMARY KEY,
                last_run INTEGER,
                next_run INTEGER,
                status TEXT DEFAULT 'idle',
                error_count INTEGER DEFAULT 0,
                last_error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.run(`
            CREATE TABLE IF NOT EXISTS batch_job_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_name TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                status TEXT NOT NULL,
                records_processed INTEGER DEFAULT 0,
                error_message TEXT,
                duration_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    registerJob(name, handler, intervalHours = 4) {
        if (this.jobs.has(name)) {
            throw new Error(`Job ${name} already registered`);
        }

        const job = {
            name,
            handler,
            intervalMs: intervalHours * 60 * 60 * 1000,
            isRunning: false
        };

        this.jobs.set(name, job);
        this.logger.info(`Registered batch job: ${name} (runs every ${intervalHours} hours)`);
    }

    async start() {
        for (const [name, job] of this.jobs) {
            await this.scheduleJob(name);
        }
        this.logger.info('Batch scheduler started');
    }

    async stop() {
        this.isRunning = false;
        this.isShuttingDown = true;
        
        // Clear all intervals
        for (const [name, intervalId] of this.intervals) {
            clearInterval(intervalId);
            this.logger.info(`Stopped job: ${name}`);
        }
        this.intervals.clear();
        
        // Clear all timeouts
        for (const [name, timeoutId] of this.timeouts) {
            clearTimeout(timeoutId);
            this.logger.info(`Cleared timeout for job: ${name}`);
        }
        this.timeouts.clear();
        
        // Wait for running jobs to complete
        const runningJobs = Array.from(this.jobs.values()).filter(j => j.isRunning);
        if (runningJobs.length > 0) {
            this.logger.info(`Waiting for ${runningJobs.length} jobs to complete...`);
            await Promise.all(runningJobs.map(job => this.waitForJobCompletion(job)));
        }
        
        await this.saveState();
        this.logger.info('Batch scheduler stopped');
        
        // Clean up process listeners
        process.removeListener('SIGINT', this.boundCleanup);
        process.removeListener('SIGTERM', this.boundCleanup);
    }

    async scheduleJob(name) {
        const job = this.jobs.get(name);
        if (!job) return;

        // Get job state from database
        const jobState = await this.db.get(
            'SELECT * FROM batch_jobs WHERE job_name = ?',
            [name]
        );

        const now = Date.now();
        let nextRun;

        if (!jobState) {
            // First time running this job
            nextRun = now + job.intervalMs;
            await this.db.run(
                'INSERT INTO batch_jobs (job_name, next_run) VALUES (?, ?)',
                [name, nextRun]
            );
            // Run immediately on first registration
            this.runJob(name);
        } else if (jobState.next_run && jobState.next_run > now) {
            // Job has a scheduled time in the future
            nextRun = jobState.next_run;
            const delay = nextRun - now;
            const timeoutId = setTimeout(() => {
                this.timeouts.delete(name);
                if (!this.isShuttingDown) {
                    this.runJob(name);
                }
            }, delay);
            this.timeouts.set(name, timeoutId);
            this.logger.info(`Job ${name} scheduled to run in ${Math.round(delay / 1000 / 60)} minutes`);
        } else {
            // Job should run now
            nextRun = now + job.intervalMs;
            this.runJob(name);
        }

        // Set up recurring interval
        const intervalId = setInterval(() => {
            if (this.isRunning && !this.isShuttingDown) {
                this.runJob(name);
            }
        }, job.intervalMs);
        
        this.intervals.set(name, intervalId);
    }

    async runJob(name) {
        const job = this.jobs.get(name);
        if (!job || job.isRunning) {
            return;
        }

        job.isRunning = true;
        const startTime = Date.now();
        
        this.logger.info(`Starting batch job: ${name}`);
        this.emit('job:start', { name, startTime });

        try {
            // Update job status
            await this.db.run(
                'UPDATE batch_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE job_name = ?',
                ['running', name]
            );

            // Create history entry
            const { lastID } = await this.db.run(
                'INSERT INTO batch_job_history (job_name, started_at, status) VALUES (?, ?, ?)',
                [name, startTime, 'running']
            );

            // Run the job
            const result = await job.handler();
            const duration = Date.now() - startTime;

            // Update history
            await this.db.run(
                `UPDATE batch_job_history 
                 SET completed_at = ?, status = ?, records_processed = ?, duration_ms = ?
                 WHERE id = ?`,
                [Date.now(), 'completed', result.recordsProcessed || 0, duration, lastID]
            );

            // Update job state
            const nextRun = Date.now() + job.intervalMs;
            await this.db.run(
                `UPDATE batch_jobs 
                 SET last_run = ?, next_run = ?, status = ?, error_count = 0, 
                     last_error = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE job_name = ?`,
                [startTime, nextRun, 'idle', name]
            );

            this.logger.info(`Completed batch job: ${name} (${duration}ms, ${result.recordsProcessed || 0} records)`);
            this.emit('job:complete', { name, duration, result });

        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Batch job failed: ${name}`, error);
            
            // Update job error state
            await this.db.run(
                `UPDATE batch_jobs 
                 SET status = ?, error_count = error_count + 1, 
                     last_error = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE job_name = ?`,
                ['error', error.message, name]
            );

            // Update history
            await this.db.run(
                `UPDATE batch_job_history 
                 SET completed_at = ?, status = ?, error_message = ?, duration_ms = ?
                 WHERE id = (
                     SELECT id FROM batch_job_history 
                     WHERE job_name = ? AND completed_at IS NULL 
                     ORDER BY id DESC 
                     LIMIT 1
                 )`,
                [Date.now(), 'error', error.message, duration, name]
            );

            this.emit('job:error', { name, error, duration });
        } finally {
            job.isRunning = false;
        }
    }

    async waitForJobCompletion(job, timeout = 300000) { // 5 minute timeout
        const start = Date.now();
        while (job.isRunning && Date.now() - start < timeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (job.isRunning) {
            this.logger.warn(`Job ${job.name} did not complete within timeout`);
        }
    }

    async getJobStatus(name) {
        return await this.db.get(
            'SELECT * FROM batch_jobs WHERE job_name = ?',
            [name]
        );
    }

    async getJobHistory(name, limit = 10) {
        return await this.db.all(
            `SELECT * FROM batch_job_history 
             WHERE job_name = ? 
             ORDER BY id DESC 
             LIMIT ?`,
            [name, limit]
        );
    }

    async getAllJobStatuses() {
        return await this.db.all('SELECT * FROM batch_jobs ORDER BY job_name');
    }

    async saveState() {
        const state = {
            jobs: Array.from(this.jobs.keys()),
            savedAt: new Date().toISOString()
        };
        
        const dir = path.dirname(this.stateFile);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    }

    async loadState() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const state = JSON.parse(data);
            this.logger.info(`Loaded batch scheduler state from ${state.savedAt}`);
            return state;
        } catch (error) {
            // State file doesn't exist yet
            return null;
        }
    }

    // Utility method to run a job immediately (useful for testing/debugging)
    async runJobNow(name) {
        if (!this.jobs.has(name)) {
            throw new Error(`Job ${name} not found`);
        }
        await this.runJob(name);
    }
    
    /**
     * Emergency cleanup method for timers and intervals
     */
    async cleanup() {
        if (this.isShuttingDown) return; // Prevent duplicate cleanup
        
        this.logger.info('BatchScheduler: Emergency cleanup initiated');
        
        // Stop the scheduler
        await this.stop();
        
        this.logger.info('BatchScheduler: Emergency cleanup completed');
    }
    
    /**
     * Get current timer statistics for monitoring
     */
    getTimerStats() {
        return {
            activeIntervals: this.intervals.size,
            activeTimeouts: this.timeouts.size,
            runningJobs: Array.from(this.jobs.values()).filter(j => j.isRunning).length,
            totalJobs: this.jobs.size,
            isRunning: this.isRunning,
            isShuttingDown: this.isShuttingDown
        };
    }
    
    /**
     * Check for timer leaks - returns jobs with suspicious timer counts
     */
    detectTimerLeaks() {
        const leaks = [];
        
        // Check for orphaned timeouts
        for (const [jobName, timeoutId] of this.timeouts) {
            if (!this.jobs.has(jobName)) {
                leaks.push({
                    type: 'orphaned_timeout',
                    jobName,
                    timeoutId
                });
            }
        }
        
        // Check for orphaned intervals
        for (const [jobName, intervalId] of this.intervals) {
            if (!this.jobs.has(jobName)) {
                leaks.push({
                    type: 'orphaned_interval',
                    jobName,
                    intervalId
                });
            }
        }
        
        return leaks;
    }
}

export default BatchScheduler;