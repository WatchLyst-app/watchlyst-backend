import * as admin from 'firebase-admin';

// ===== PERFORMANCE OPTIMIZATION CONFIGURATION =====

export const OptimizationConfig = {
  // Caching Configuration
  caching: {
    // Recommendation cache TTL (in seconds)
    recommendationCacheTTL: 3600, // 1 hour
    
    // User preference cache TTL
    preferenceCacheTTL: 300, // 5 minutes
    
    // Movie feature vector cache
    movieFeatureCacheTTL: 86400, // 24 hours
    
    // Enable Firestore offline persistence
    enableOfflinePersistence: true,
  },

  // Batch Processing Configuration
  batching: {
    // Maximum interactions to process in a single batch
    maxBatchSize: 500,
    
    // Batch processing interval (milliseconds)
    batchInterval: 5000, // 5 seconds
    
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
class MemoryCache<T> {
  private cache: Map<string, { value: T; expiry: number }> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }

  get(key: string): T | null {
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

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global caches
export const recommendationCache = new MemoryCache(100);
export const preferenceCache = new MemoryCache(100);
export const movieFeatureCache = new MemoryCache(500);

// ===== BATCH PROCESSING =====

interface BatchItem {
  userId: string;
  movieId: string;
  action: string;
  timestamp: admin.firestore.Timestamp;
}

class BatchProcessor {
  private queue: BatchItem[] = [];
  private processing = false;
  private timer: NodeJS.Timeout | null = null;

  async addItem(item: BatchItem): Promise<void> {
    this.queue.push(item);

    if (this.queue.length >= OptimizationConfig.batching.maxBatchSize) {
      await this.processBatch();
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.processBatch();
      }, OptimizationConfig.batching.batchInterval);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Take items from queue
    const items = this.queue.splice(0, OptimizationConfig.batching.maxBatchSize);

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
      
    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-queue failed items
      this.queue.unshift(...items);
    } finally {
      this.processing = false;
    }
  }
}

export const batchProcessor = new BatchProcessor();

// ===== QUERY OPTIMIZATION HELPERS =====

export async function getMoviesWithCaching(
  limit: number = 100,
  orderBy: string = 'popularity'
): Promise<any[]> {
  const cacheKey = `movies_${orderBy}_${limit}`;
  
  // Check cache first
  const cached = movieFeatureCache.get(cacheKey);
  if (cached) {
    return cached as any[];
  }

  // Fetch from Firestore
  const snapshot = await admin.firestore()
    .collection('movies')
    .orderBy(orderBy, 'desc')
    .limit(limit)
    .get();

  const movies = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Cache results
  movieFeatureCache.set(
    cacheKey, 
    movies, 
    OptimizationConfig.caching.movieFeatureCacheTTL
  );

  return movies;
}

// ===== FIRESTORE OPTIMIZATION =====

export function optimizeFirestoreQueries(): void {
  const firestore = admin.firestore();
  
  // Enable offline persistence for better performance
  firestore.settings({
    cacheSizeBytes: 100 * 1024 * 1024, // 100MB cache
    ignoreUndefinedProperties: true,
  });
}

// ===== LEARNING RATE ADJUSTMENT =====

export function getAdaptiveLearningRate(totalInteractions: number): number {
  const config = OptimizationConfig.learning.adaptiveLearningRate;
  
  const decaySteps = Math.floor(totalInteractions / config.updateInterval);
  const learningRate = config.initial * Math.pow(config.decay, decaySteps);
  
  return Math.max(learningRate, config.minimum);
}

// ===== MEMORY MANAGEMENT =====

let gcInterval: NodeJS.Timeout | null = null;

export function startMemoryManagement(): void {
  if (OptimizationConfig.memory.enableGCOptimization && !gcInterval) {
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
        recommendationCache.clear();
        preferenceCache.clear();
        movieFeatureCache.clear();
      }
    }, 60000); // Every minute
  }
}

export function stopMemoryManagement(): void {
  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
  }
}

// ===== PERFORMANCE MONITORING =====

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000;

  startTimer(operation: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }

  private recordMetric(operation: string, duration: number): void {
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

  getStats(): any {
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric.duration);
      return acc;
    }, {} as Record<string, number[]>);

    const stats: any = {};
    
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

export const performanceMonitor = new PerformanceMonitor();

// ===== RECOMMENDATION QUEUE OPTIMIZATION =====

export async function precomputeRecommendations(userId: string): Promise<void> {
  console.log(`Precomputing recommendations for user ${userId}`);
  
  const timer = performanceMonitor.startTimer('precomputeRecommendations');
  
  try {
    // Implementation would go here
    // This would run as a background job to prepare recommendations
    // before the user needs them
    
    timer();
  } catch (error) {
    timer();
    throw error;
  }
}

// Export configuration for Cloud Functions
export const functionConfig = {
  memory: OptimizationConfig.functions.memory,
  timeoutSeconds: OptimizationConfig.functions.timeoutSeconds,
  maxInstances: OptimizationConfig.functions.maxInstances,
  minInstances: OptimizationConfig.functions.minInstances,
};
