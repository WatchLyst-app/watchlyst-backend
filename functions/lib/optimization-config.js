"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.functionConfig = exports.precomputeRecommendations = exports.performanceMonitor = exports.stopMemoryManagement = exports.startMemoryManagement = exports.getAdaptiveLearningRate = exports.optimizeFirestoreQueries = exports.getMoviesWithCaching = exports.batchProcessor = exports.movieFeatureCache = exports.preferenceCache = exports.recommendationCache = exports.OptimizationConfig = void 0;
const admin = require("firebase-admin");
// ===== PERFORMANCE OPTIMIZATION CONFIGURATION =====
exports.OptimizationConfig = {
    // Caching Configuration
    caching: {
        // Recommendation cache TTL (in seconds)
        recommendationCacheTTL: 3600,
        // User preference cache TTL
        preferenceCacheTTL: 300,
        // Movie feature vector cache
        movieFeatureCacheTTL: 86400,
        // Enable Firestore offline persistence
        enableOfflinePersistence: true,
    },
    // Batch Processing Configuration
    batching: {
        // Maximum interactions to process in a single batch
        maxBatchSize: 500,
        // Batch processing interval (milliseconds)
        batchInterval: 5000,
        // Enable batch writes for performance
        enableBatchWrites: true,
        // Maximum concurrent batches
        maxConcurrentBatches: 3,
    },
    // Query Optimization
    queries: {
        // Maximum movies to fetch for scoring
        maxMoviesForScoring: 1000,
        // Default page size for movie queries
        moviePageSize: 100,
        // Enable query result caching
        enableQueryCache: true,
        // Composite index hints
        compositeIndexes: [
            'movies.popularity_desc_voteAverage_desc',
            'interactions.userId_asc_timestamp_desc',
            'movies.recommendationData.totalInteractions_desc',
        ],
    },
    // Learning Rate Optimization
    learning: {
        // Adaptive learning rate based on interaction count
        adaptiveLearningRate: {
            initial: 0.1,
            decay: 0.95,
            minimum: 0.01,
            updateInterval: 100, // interactions
        },
        // Early stopping for preference updates
        convergenceThreshold: 0.001,
        // Maximum preference vector magnitude
        maxVectorMagnitude: 1.0,
    },
    // Memory Management
    memory: {
        // Maximum items in memory cache
        maxCacheSize: 1000,
        // LRU cache for movie features
        movieFeatureCacheSize: 500,
        // Preference vector cache size
        preferenceVectorCacheSize: 100,
        // Enable garbage collection hints
        enableGCOptimization: true,
    },
    // Function Optimization
    functions: {
        // Function memory allocation
        memory: '512MB',
        // Function timeout
        timeoutSeconds: 60,
        // Maximum concurrent executions
        maxInstances: 10,
        // Cold start optimization
        minInstances: 1,
    },
};
// ===== CACHING STRATEGIES =====
// In-memory cache implementation
class MemoryCache {
    constructor(maxSize = 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    set(key, value, ttlSeconds) {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { value, expiry });
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}
// Global caches
exports.recommendationCache = new MemoryCache(100);
exports.preferenceCache = new MemoryCache(100);
exports.movieFeatureCache = new MemoryCache(500);
class BatchProcessor {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.timer = null;
    }
    async addItem(item) {
        this.queue.push(item);
        if (this.queue.length >= exports.OptimizationConfig.batching.maxBatchSize) {
            await this.processBatch();
        }
        else if (!this.timer) {
            this.timer = setTimeout(() => {
                this.processBatch();
            }, exports.OptimizationConfig.batching.batchInterval);
        }
    }
    async processBatch() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        // Take items from queue
        const items = this.queue.splice(0, exports.OptimizationConfig.batching.maxBatchSize);
        try {
            // Process items in batch
            const batch = admin.firestore().batch();
            for (const item of items) {
                // Add batch operations here
                const interactionRef = admin.firestore()
                    .collection('interactions')
                    .doc();
                batch.set(interactionRef, item);
            }
            await batch.commit();
            console.log(`Processed batch of ${items.length} interactions`);
        }
        catch (error) {
            console.error('Batch processing error:', error);
            // Re-queue failed items
            this.queue.unshift(...items);
        }
        finally {
            this.processing = false;
        }
    }
}
exports.batchProcessor = new BatchProcessor();
// ===== QUERY OPTIMIZATION HELPERS =====
async function getMoviesWithCaching(limit = 100, orderBy = 'popularity') {
    const cacheKey = `movies_${orderBy}_${limit}`;
    // Check cache first
    const cached = exports.movieFeatureCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    // Fetch from Firestore
    const snapshot = await admin.firestore()
        .collection('movies')
        .orderBy(orderBy, 'desc')
        .limit(limit)
        .get();
    const movies = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    // Cache results
    exports.movieFeatureCache.set(cacheKey, movies, exports.OptimizationConfig.caching.movieFeatureCacheTTL);
    return movies;
}
exports.getMoviesWithCaching = getMoviesWithCaching;
// ===== FIRESTORE OPTIMIZATION =====
function optimizeFirestoreQueries() {
    const firestore = admin.firestore();
    // Enable offline persistence for better performance
    firestore.settings({
        cacheSizeBytes: 100 * 1024 * 1024,
        ignoreUndefinedProperties: true,
    });
}
exports.optimizeFirestoreQueries = optimizeFirestoreQueries;
// ===== LEARNING RATE ADJUSTMENT =====
function getAdaptiveLearningRate(totalInteractions) {
    const config = exports.OptimizationConfig.learning.adaptiveLearningRate;
    const decaySteps = Math.floor(totalInteractions / config.updateInterval);
    const learningRate = config.initial * Math.pow(config.decay, decaySteps);
    return Math.max(learningRate, config.minimum);
}
exports.getAdaptiveLearningRate = getAdaptiveLearningRate;
// ===== MEMORY MANAGEMENT =====
let gcInterval = null;
function startMemoryManagement() {
    if (exports.OptimizationConfig.memory.enableGCOptimization && !gcInterval) {
        gcInterval = setInterval(() => {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            // Log memory usage
            const usage = process.memoryUsage();
            console.log('Memory usage:', {
                rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
            });
            // Clear caches if memory usage is high
            if (usage.heapUsed > usage.heapTotal * 0.8) {
                console.log('High memory usage detected, clearing caches');
                exports.recommendationCache.clear();
                exports.preferenceCache.clear();
                exports.movieFeatureCache.clear();
            }
        }, 60000); // Every minute
    }
}
exports.startMemoryManagement = startMemoryManagement;
function stopMemoryManagement() {
    if (gcInterval) {
        clearInterval(gcInterval);
        gcInterval = null;
    }
}
exports.stopMemoryManagement = stopMemoryManagement;
class PerformanceMonitor {
    constructor() {
        this.metrics = [];
        this.maxMetrics = 1000;
    }
    startTimer(operation) {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            this.recordMetric(operation, duration);
        };
    }
    recordMetric(operation, duration) {
        this.metrics.push({
            operation,
            duration,
            timestamp: Date.now(),
        });
        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
        // Log slow operations
        if (duration > 1000) {
            console.warn(`Slow operation detected: ${operation} took ${duration}ms`);
        }
    }
    getStats() {
        const grouped = this.metrics.reduce((acc, metric) => {
            if (!acc[metric.operation]) {
                acc[metric.operation] = [];
            }
            acc[metric.operation].push(metric.duration);
            return acc;
        }, {});
        const stats = {};
        for (const [operation, durations] of Object.entries(grouped)) {
            const sorted = durations.sort((a, b) => a - b);
            stats[operation] = {
                count: durations.length,
                avg: durations.reduce((a, b) => a + b, 0) / durations.length,
                p50: sorted[Math.floor(sorted.length * 0.5)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                p99: sorted[Math.floor(sorted.length * 0.99)],
            };
        }
        return stats;
    }
}
exports.performanceMonitor = new PerformanceMonitor();
// ===== RECOMMENDATION QUEUE OPTIMIZATION =====
async function precomputeRecommendations(userId) {
    console.log(`Precomputing recommendations for user ${userId}`);
    const timer = exports.performanceMonitor.startTimer('precomputeRecommendations');
    try {
        // Implementation would go here
        // This would run as a background job to prepare recommendations
        // before the user needs them
        timer();
    }
    catch (error) {
        timer();
        throw error;
    }
}
exports.precomputeRecommendations = precomputeRecommendations;
// Export configuration for Cloud Functions
exports.functionConfig = {
    memory: exports.OptimizationConfig.functions.memory,
    timeoutSeconds: exports.OptimizationConfig.functions.timeoutSeconds,
    maxInstances: exports.OptimizationConfig.functions.maxInstances,
    minInstances: exports.OptimizationConfig.functions.minInstances,
};
//# sourceMappingURL=optimization-config.js.map