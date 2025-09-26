// Firestore Database Schema for WatchLyst Recommendation System Phase 1

// Collections Structure with Document Examples

const collections = {
  // 1. USERS COLLECTION
  users: {
    documentId: 'userId', // Firebase Auth UID
    fields: {
      email: { type: 'string', required: true },
      displayName: { type: 'string', required: false },
      photoURL: { type: 'string', required: false },
      createdAt: { type: 'timestamp', required: true },
      updatedAt: { type: 'timestamp', required: true },
      
      // Onboarding preferences
      selectedCategories: { 
        type: 'array', 
        items: 'string',
        example: ['action', 'comedy', 'thriller'],
        description: 'Selected during onboarding'
      },
      
      // Recommendation settings
      recommendationSettings: {
        type: 'map',
        fields: {
          explorationRate: { type: 'number', default: 0.15 },
          minQueueSize: { type: 'number', default: 50 },
          refreshInterval: { type: 'number', default: 5 }, // swipes
        }
      },
      
      // Statistics
      stats: {
        type: 'map',
        fields: {
          totalSwipes: { type: 'number', default: 0 },
          likeRatio: { type: 'number', default: 0 },
          lastSwipeAt: { type: 'timestamp', required: false },
          swipesByAction: {
            type: 'map',
            fields: {
              loved: { type: 'number', default: 0 },
              liked: { type: 'number', default: 0 },
              seen: { type: 'number', default: 0 },
              not_seen: { type: 'number', default: 0 },
              disliked: { type: 'number', default: 0 }
            }
          }
        }
      }
    }
  },

  // 2. MOVIES COLLECTION (Enhanced with feature vectors)
  movies: {
    documentId: 'tmdbId', // TMDB movie ID as string
    fields: {
      // Basic info (existing fields)
      tmdbId: { type: 'number', required: true },
      title: { type: 'string', required: true },
      overview: { type: 'string', required: true },
      posterPath: { type: 'string', required: true },
      backdropPath: { type: 'string', required: false },
      releaseDate: { type: 'string', required: true },
      voteAverage: { type: 'number', required: true },
      voteCount: { type: 'number', required: true },
      popularity: { type: 'number', required: true },
      runtime: { type: 'number', required: false },
      
      // Genres
      genreIds: { type: 'array', items: 'number', required: true },
      genres: { type: 'array', items: 'string', required: true },
      
      // Feature vector for recommendations (6 dimensions)
      featureVector: {
        type: 'map',
        required: true,
        fields: {
          genre_action: { type: 'number', range: [0, 1] },
          genre_comedy: { type: 'number', range: [0, 1] },
          genre_drama: { type: 'number', range: [0, 1] },
          genre_horror: { type: 'number', range: [0, 1] },
          genre_romance: { type: 'number', range: [0, 1] },
          genre_scifi: { type: 'number', range: [0, 1] },
          popularity_normalized: { type: 'number', range: [0, 1] },
          recency_score: { type: 'number', range: [0, 1] }, // Based on release date
          rating_normalized: { type: 'number', range: [0, 1] } // voteAverage / 10
        }
      },
      
      // Recommendation metadata
      recommendationData: {
        type: 'map',
        fields: {
          totalInteractions: { type: 'number', default: 0 },
          positiveInteractions: { type: 'number', default: 0 },
          lastInteractionAt: { type: 'timestamp', required: false }
        }
      },
      
      createdAt: { type: 'timestamp', required: true },
      updatedAt: { type: 'timestamp', required: true }
    }
  },

  // 3. USER PREFERENCES COLLECTION (ML model state)
  userPreferences: {
    documentId: 'userId',
    fields: {
      userId: { type: 'string', required: true },
      
      // Preference vector (matches movie feature dimensions)
      preferenceVector: {
        type: 'map',
        required: true,
        fields: {
          genre_action: { type: 'number', default: 0 },
          genre_comedy: { type: 'number', default: 0 },
          genre_drama: { type: 'number', default: 0 },
          genre_horror: { type: 'number', default: 0 },
          genre_romance: { type: 'number', default: 0 },
          genre_scifi: { type: 'number', default: 0 },
          popularity_normalized: { type: 'number', default: 0 },
          recency_score: { type: 'number', default: 0 },
          rating_normalized: { type: 'number', default: 0 }
        }
      },
      
      // Learning parameters
      learningMetadata: {
        type: 'map',
        fields: {
          learningRate: { type: 'number', default: 0.1 },
          decayFactor: { type: 'number', default: 0.95 },
          totalUpdates: { type: 'number', default: 0 },
          modelConfidence: { type: 'number', default: 0 } // 0-1 based on interaction count
        }
      },
      
      updatedAt: { type: 'timestamp', required: true }
    }
  },

  // 4. INTERACTIONS COLLECTION (User swipe history)
  interactions: {
    documentId: 'auto-generated',
    fields: {
      userId: { type: 'string', required: true },
      movieId: { type: 'string', required: true },
      action: { 
        type: 'string', 
        required: true,
        enum: ['loved', 'liked', 'seen', 'not_seen', 'disliked']
      },
      
      // Scoring details at time of interaction
      scoringData: {
        type: 'map',
        fields: {
          baseScore: { type: 'number', required: true },
          gestureWeight: { type: 'number', required: true },
          explorationBonus: { type: 'number', default: 0 },
          finalScore: { type: 'number', required: true },
          preferenceVectorBefore: { type: 'map', required: true },
          preferenceVectorAfter: { type: 'map', required: true }
        }
      },
      
      // Context
      context: {
        type: 'map',
        fields: {
          queuePosition: { type: 'number', required: false },
          sessionId: { type: 'string', required: false },
          platform: { type: 'string', required: false } // ios/android/web
        }
      },
      
      timestamp: { type: 'timestamp', required: true }
    }
  },

  // 5. RECOMMENDATIONS COLLECTION (Pre-computed recommendation queues)
  recommendations: {
    documentId: 'userId',
    fields: {
      userId: { type: 'string', required: true },
      
      // Current recommendation queue
      queue: {
        type: 'array',
        required: true,
        items: {
          type: 'map',
          fields: {
            movieId: { type: 'string', required: true },
            score: { type: 'number', required: true },
            reason: { 
              type: 'string', 
              enum: ['preference_match', 'trending', 'exploration', 'category_match'] 
            },
            position: { type: 'number', required: true }
          }
        }
      },
      
      // Queue metadata
      metadata: {
        type: 'map',
        fields: {
          generatedAt: { type: 'timestamp', required: true },
          algorithm: { type: 'string', default: 'collaborative_content_v1' },
          totalMoviesScored: { type: 'number', required: true },
          averageScore: { type: 'number', required: true },
          explorationRate: { type: 'number', required: true }
        }
      },
      
      // Next refresh info
      nextRefresh: {
        type: 'map',
        fields: {
          afterSwipes: { type: 'number', default: 5 },
          scheduledAt: { type: 'timestamp', required: false }
        }
      },
      
      updatedAt: { type: 'timestamp', required: true }
    }
  }
};

// Required Composite Indexes
const indexes = [
  {
    collection: 'interactions',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'timestamp', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'interactions',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'movieId', order: 'ASCENDING' }
    ]
  },
  {
    collection: 'interactions',
    fields: [
      { field: 'movieId', order: 'ASCENDING' },
      { field: 'action', order: 'ASCENDING' }
    ]
  },
  {
    collection: 'movies',
    fields: [
      { field: 'popularity', order: 'DESCENDING' },
      { field: 'voteAverage', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'movies',
    fields: [
      { field: 'recommendationData.totalInteractions', order: 'DESCENDING' },
      { field: 'popularity', order: 'DESCENDING' }
    ]
  }
];

// Sample Documents for Testing
const sampleData = {
  user: {
    email: 'test@example.com',
    displayName: 'Test User',
    selectedCategories: ['action', 'scifi', 'thriller'],
    recommendationSettings: {
      explorationRate: 0.15,
      minQueueSize: 50,
      refreshInterval: 5
    },
    stats: {
      totalSwipes: 0,
      likeRatio: 0,
      swipesByAction: {
        loved: 0,
        liked: 0,
        seen: 0,
        not_seen: 0,
        disliked: 0
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  userPreference: {
    userId: 'testUserId',
    preferenceVector: {
      genre_action: 0,
      genre_comedy: 0,
      genre_drama: 0,
      genre_horror: 0,
      genre_romance: 0,
      genre_scifi: 0,
      popularity_normalized: 0,
      recency_score: 0,
      rating_normalized: 0
    },
    learningMetadata: {
      learningRate: 0.1,
      decayFactor: 0.95,
      totalUpdates: 0,
      modelConfidence: 0
    },
    updatedAt: new Date()
  },
  
  interaction: {
    userId: 'testUserId',
    movieId: '550', // Fight Club
    action: 'liked',
    scoringData: {
      baseScore: 0.75,
      gestureWeight: 1.5,
      explorationBonus: 0,
      finalScore: 1.125,
      preferenceVectorBefore: { /* vector values */ },
      preferenceVectorAfter: { /* updated vector values */ }
    },
    context: {
      queuePosition: 1,
      sessionId: 'session123',
      platform: 'ios'
    },
    timestamp: new Date()
  }
};

module.exports = {
  collections,
  indexes,
  sampleData
};
