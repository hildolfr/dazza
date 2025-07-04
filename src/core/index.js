// Core components for the modular architecture

const BaseModule = require('./BaseModule');
const EventBus = require('./EventBus');
const ModuleLoader = require('./ModuleLoader');
const ModuleRegistry = require('./ModuleRegistry');
const UnifiedScheduler = require('./UnifiedScheduler');
const PerformanceMonitor = require('./PerformanceMonitor');
const ErrorHandler = require('./ErrorHandler');

module.exports = {
    BaseModule,
    EventBus,
    ModuleLoader,
    ModuleRegistry,
    UnifiedScheduler,
    PerformanceMonitor,
    ErrorHandler
};