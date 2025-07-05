import { EventEmitter } from 'events';
import cron from 'node-cron';

class UnifiedScheduler extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            timezone: 'Australia/Sydney',
            maxConcurrent: 10,
            ...config
        };
        
        // Task tracking
        this.tasks = new Map(); // taskId -> task object
        this.intervals = new Map(); // taskId -> interval
        this.timeouts = new Map(); // taskId -> timeout
        this.cronJobs = new Map(); // taskId -> cron job
        
        // Module tracking
        this.moduleTasks = new Map(); // moduleId -> Set of taskIds
        
        // Execution tracking
        this.running = new Set();
        this.history = [];
        this.maxHistory = 1000;
        
        // Statistics
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            taskStats: new Map()
        };
    }
    
    // ===== Task Scheduling =====
    
    schedule(taskId, cronPattern, handler, options = {}) {
        if (this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} already exists`);
        }
        
        const task = {
            id: taskId,
            type: 'cron',
            pattern: cronPattern,
            handler,
            options,
            created: Date.now(),
            lastRun: null,
            nextRun: null,
            enabled: true
        };
        
        // Validate cron pattern
        if (!cron.validate(cronPattern)) {
            throw new Error(`Invalid cron pattern: ${cronPattern}`);
        }
        
        // Create cron job
        const job = cron.schedule(cronPattern, 
            () => this.executeTask(task),
            {
                scheduled: false,
                timezone: this.config.timezone
            }
        );
        
        // Store references
        this.tasks.set(taskId, task);
        this.cronJobs.set(taskId, job);
        this.trackModuleTask(taskId, options.module);
        
        // Start if not explicitly disabled
        if (options.start !== false) {
            job.start();
            task.nextRun = this.getNextRun(cronPattern);
        }
        
        this.emit('task:scheduled', { taskId, type: 'cron', pattern: cronPattern });
        
        return taskId;
    }
    
    interval(taskId, intervalMs, handler, options = {}) {
        if (this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} already exists`);
        }
        
        const task = {
            id: taskId,
            type: 'interval',
            interval: intervalMs,
            handler,
            options,
            created: Date.now(),
            lastRun: null,
            nextRun: Date.now() + intervalMs,
            enabled: true
        };
        
        // Create interval
        const interval = setInterval(
            () => this.executeTask(task),
            intervalMs
        );
        
        // Store references
        this.tasks.set(taskId, task);
        this.intervals.set(taskId, interval);
        this.trackModuleTask(taskId, options.module);
        
        // Execute immediately if requested
        if (options.immediate) {
            setImmediate(() => this.executeTask(task));
        }
        
        this.emit('task:scheduled', { taskId, type: 'interval', interval: intervalMs });
        
        return taskId;
    }
    
    timeout(taskId, delayMs, handler, options = {}) {
        if (this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} already exists`);
        }
        
        const task = {
            id: taskId,
            type: 'timeout',
            delay: delayMs,
            handler,
            options,
            created: Date.now(),
            executeAt: Date.now() + delayMs,
            enabled: true
        };
        
        // Create timeout
        const timeout = setTimeout(
            () => {
                this.executeTask(task);
                this.removeTask(taskId);
            },
            delayMs
        );
        
        // Store references
        this.tasks.set(taskId, task);
        this.timeouts.set(taskId, timeout);
        this.trackModuleTask(taskId, options.module);
        
        this.emit('task:scheduled', { taskId, type: 'timeout', delay: delayMs });
        
        return taskId;
    }
    
    // ===== Task Execution =====
    
    async executeTask(task) {
        if (!task.enabled) return;
        
        // Check concurrency limit
        if (this.running.size >= this.config.maxConcurrent) {
            this.emit('task:queued', { taskId: task.id });
            // Retry after a short delay
            setTimeout(() => this.executeTask(task), 1000);
            return;
        }
        
        const startTime = Date.now();
        this.running.add(task.id);
        
        this.emit('task:start', { taskId: task.id });
        
        try {
            // Execute handler
            const result = await task.handler();
            
            // Update task info
            task.lastRun = startTime;
            if (task.type === 'cron') {
                task.nextRun = this.getNextRun(task.pattern);
            } else if (task.type === 'interval') {
                task.nextRun = Date.now() + task.interval;
            }
            
            // Track execution
            const duration = Date.now() - startTime;
            this.trackExecution(task, true, duration, result);
            
            this.emit('task:complete', { 
                taskId: task.id, 
                duration, 
                result 
            });
            
        } catch (error) {
            // Track failure
            const duration = Date.now() - startTime;
            this.trackExecution(task, false, duration, error);
            
            this.emit('task:error', { 
                taskId: task.id, 
                duration,
                error: error.message,
                stack: error.stack
            });
            
            // Retry logic could go here
        } finally {
            this.running.delete(task.id);
        }
    }
    
    // ===== Task Management =====
    
    removeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        // Clean up based on task type
        if (task.type === 'cron') {
            const job = this.cronJobs.get(taskId);
            if (job) {
                job.stop();
                this.cronJobs.delete(taskId);
            }
        } else if (task.type === 'interval') {
            const interval = this.intervals.get(taskId);
            if (interval) {
                clearInterval(interval);
                this.intervals.delete(taskId);
            }
        } else if (task.type === 'timeout') {
            const timeout = this.timeouts.get(taskId);
            if (timeout) {
                clearTimeout(timeout);
                this.timeouts.delete(taskId);
            }
        }
        
        // Remove from tracking
        this.tasks.delete(taskId);
        this.untrackModuleTask(taskId);
        
        this.emit('task:removed', { taskId });
        
        return true;
    }
    
    removeModuleTasks(moduleId) {
        const taskIds = this.moduleTasks.get(moduleId);
        if (!taskIds) return;
        
        for (const taskId of taskIds) {
            this.removeTask(taskId);
        }
        
        this.moduleTasks.delete(moduleId);
    }
    
    pauseTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        task.enabled = false;
        
        if (task.type === 'cron') {
            const job = this.cronJobs.get(taskId);
            if (job) job.stop();
        }
        
        this.emit('task:paused', { taskId });
        return true;
    }
    
    resumeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        task.enabled = true;
        
        if (task.type === 'cron') {
            const job = this.cronJobs.get(taskId);
            if (job) {
                job.start();
                task.nextRun = this.getNextRun(task.pattern);
            }
        }
        
        this.emit('task:resumed', { taskId });
        return true;
    }
    
    // ===== Tracking =====
    
    trackModuleTask(taskId, moduleId) {
        if (!moduleId) return;
        
        if (!this.moduleTasks.has(moduleId)) {
            this.moduleTasks.set(moduleId, new Set());
        }
        
        this.moduleTasks.get(moduleId).add(taskId);
    }
    
    untrackModuleTask(taskId) {
        for (const [moduleId, tasks] of this.moduleTasks.entries()) {
            if (tasks.has(taskId)) {
                tasks.delete(taskId);
                if (tasks.size === 0) {
                    this.moduleTasks.delete(moduleId);
                }
                break;
            }
        }
    }
    
    trackExecution(task, success, duration, result) {
        // Update statistics
        this.stats.totalExecutions++;
        if (success) {
            this.stats.successfulExecutions++;
        } else {
            this.stats.failedExecutions++;
        }
        
        // Track per-task stats
        if (!this.stats.taskStats.has(task.id)) {
            this.stats.taskStats.set(task.id, {
                executions: 0,
                successes: 0,
                failures: 0,
                totalDuration: 0,
                avgDuration: 0,
                lastDuration: 0
            });
        }
        
        const taskStats = this.stats.taskStats.get(task.id);
        taskStats.executions++;
        if (success) taskStats.successes++;
        else taskStats.failures++;
        taskStats.totalDuration += duration;
        taskStats.avgDuration = taskStats.totalDuration / taskStats.executions;
        taskStats.lastDuration = duration;
        
        // Add to history
        this.history.push({
            taskId: task.id,
            timestamp: Date.now(),
            success,
            duration,
            result: success ? result : result?.message
        });
        
        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    // ===== Utilities =====
    
    getNextRun(cronPattern) {
        const interval = cron.schedule(cronPattern, () => {}, { 
            scheduled: false,
            timezone: this.config.timezone
        });
        
        const next = interval.getNextRun();
        interval.stop();
        
        return next ? next.getTime() : null;
    }
    
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    
    getTasks(filter = {}) {
        let tasks = Array.from(this.tasks.values());
        
        if (filter.module) {
            const moduleTaskIds = this.moduleTasks.get(filter.module);
            if (moduleTaskIds) {
                tasks = tasks.filter(t => moduleTaskIds.has(t.id));
            } else {
                tasks = [];
            }
        }
        
        if (filter.type) {
            tasks = tasks.filter(t => t.type === filter.type);
        }
        
        if (filter.enabled !== undefined) {
            tasks = tasks.filter(t => t.enabled === filter.enabled);
        }
        
        return tasks;
    }
    
    getStats() {
        return {
            ...this.stats,
            taskStats: Object.fromEntries(this.stats.taskStats),
            runningTasks: Array.from(this.running),
            totalTasks: this.tasks.size,
            enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length
        };
    }
    
    getHistory(taskId = null, limit = 100) {
        let history = this.history;
        
        if (taskId) {
            history = history.filter(entry => entry.taskId === taskId);
        }
        
        return history.slice(-limit);
    }
    
    // ===== Cleanup =====
    
    async stop() {
        // Stop all cron jobs
        for (const [taskId, job] of this.cronJobs) {
            job.stop();
        }
        this.cronJobs.clear();
        
        // Clear all intervals
        for (const [taskId, interval] of this.intervals) {
            clearInterval(interval);
        }
        this.intervals.clear();
        
        // Clear all timeouts
        for (const [taskId, timeout] of this.timeouts) {
            clearTimeout(timeout);
        }
        this.timeouts.clear();
        
        // Clear all tasks
        this.tasks.clear();
        this.moduleTasks.clear();
        this.running.clear();
        
        // Emit stop event
        this.emit('scheduler:stopped');
    }
}

export default UnifiedScheduler;