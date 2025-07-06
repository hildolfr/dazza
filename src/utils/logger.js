/**
 * DEPRECATED LEGACY LOGGER - USE LoggerCompatibilityLayer.js INSTEAD
 * 
 * This file has been deprecated and replaced with the Enhanced Winston Logger system.
 * All functionality has been migrated to LoggerCompatibilityLayer.js which provides
 * 100% API compatibility with enhanced features.
 * 
 * Migration status: MILESTONE 4 COMPLETED
 * - All production modules migrated
 * - Enhanced Winston backend active
 * - Compatibility layer maintains API
 * 
 * This file now redirects to the LoggerCompatibilityLayer for safety.
 */

import { createLogger as newCreateLogger, getLogger as newGetLogger } from './LoggerCompatibilityLayer.js';

// Issue deprecation warnings
function warnDeprecated(functionName) {
    console.warn(`⚠️  DEPRECATED: ${functionName} from logger.js is deprecated. Please migrate to LoggerCompatibilityLayer.js`);
    console.warn(`   See logger_refactor.md for migration instructions.`);
}

export function createLogger(options) {
    warnDeprecated('createLogger');
    return newCreateLogger(options);
}

export function getLogger() {
    warnDeprecated('getLogger');
    return newGetLogger();
}

// Re-export everything from LoggerCompatibilityLayer for full compatibility
export * from './LoggerCompatibilityLayer.js';