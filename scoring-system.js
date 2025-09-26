// WatchLyst Recommendation System - Scoring System Design
// Mathematical Model for Movie Recommendations

// ===== GESTURE WEIGHTS =====
const GESTURE_WEIGHTS = {
  loved: 3.0,      // Double Tap = Loved → +3.0000
  liked: 1.5,      // Swipe Up = Liked → +1.5000
  seen: 0.0,       // Swipe Right = Seen → +0.0000
  not_seen: 0.0,   // Swipe Left = Not Seen → +0.0000
  disliked: -2.5   // Swipe Down = Disliked → -2.5000
};

// ===== MOVIE FEATURE VECTOR (9 dimensions) =====
const FEATURE_DIMENSIONS = {
  // Genre features (0-1 normalized)
  genre_action: { min: 0, max: 1, description: 'Action genre strength' },
  genre_comedy: { min: 0, max: 1, description: 'Comedy genre strength' },
  genre_drama: { min: 0, max: 1, description: 'Drama genre strength' },
  genre_horror: { min: 0, max: 1, description: 'Horror genre strength' },
  genre_romance: { min: 0, max: 1, description: 'Romance genre strength' },
  genre_scifi: { min: 0, max: 1, description: 'Sci-Fi genre strength' },
  
  // Content features (0-1 normalized)
  popularity_normalized: { min: 0, max: 1, description: 'Popularity percentile' },
  recency_score: { min: 0, max: 1, description: 'How recent the movie is' },
  rating_normalized: { min: 0, max: 1, description: 'Rating score (vote_average/10)' }
};

// ===== USER PREFERENCE VECTOR =====
// Matches movie feature dimensions, initialized to 0
const initializeUserPreferenceVector = () => ({
  genre_action: 0,
  genre_comedy: 0,
  genre_drama: 0,
  genre_horror: 0,
  genre_romance: 0,
  genre_scifi: 0,
  popularity_normalized: 0,
  recency_score: 0,
  rating_normalized: 0
});

// ===== SCORING ALGORITHM =====
// Score = dotProduct(userPreferences, movieFeatures) + explorationBonus

/**
 * Calculate recommendation score for a movie
 * @param {Object} userPreferences - User preference vector
 * @param {Object} movieFeatures - Movie feature vector  
 * @param {number} explorationRate - Exploration factor (0-1)
 * @param {boolean} isExploration - Whether this movie is for exploration
 * @returns {number} Final recommendation score
 */
function calculateRecommendationScore(userPreferences, movieFeatures, explorationRate = 0.15, isExploration = false) {
  // 1. Calculate base score using dot product
  let baseScore = 0;
  for (const dimension in FEATURE_DIMENSIONS) {
    baseScore += (userPreferences[dimension] || 0) * (movieFeatures[dimension] || 0);
  }
  
  // 2. Normalize base score to [-1, 1] range
  const dimensionCount = Object.keys(FEATURE_DIMENSIONS).length;
  baseScore = baseScore / dimensionCount;
  
  // 3. Apply exploration bonus
  let explorationBonus = 0;
  if (isExploration) {
    // Exploration movies get a random bonus to ensure variety
    explorationBonus = Math.random() * explorationRate;
  }
  
  // 4. Calculate final score
  const finalScore = baseScore + explorationBonus;
  
  return {
    baseScore,
    explorationBonus,
    finalScore,
    components: {
      dotProduct: baseScore * dimensionCount,
      normalizedScore: baseScore,
      exploration: explorationBonus
    }
  };
}

// ===== LEARNING ALGORITHM =====
// Use Exponential Moving Average (EMA) to update preferences

/**
 * Update user preferences based on interaction
 * @param {Object} currentPreferences - Current user preference vector
 * @param {Object} movieFeatures - Interacted movie's feature vector
 * @param {string} action - User action (loved, liked, seen, not_seen, disliked)
 * @param {number} learningRate - Learning rate (0-1)
 * @param {number} totalInteractions - Total user interactions (for decay)
 * @returns {Object} Updated preference vector
 */
function updateUserPreferences(currentPreferences, movieFeatures, action, learningRate = 0.1, totalInteractions = 0) {
  // Get gesture weight
  const gestureWeight = GESTURE_WEIGHTS[action];
  
  // Apply learning rate decay (slower learning as user interacts more)
  const decayFactor = 0.95;
  const effectiveLearningRate = learningRate * Math.pow(decayFactor, Math.floor(totalInteractions / 100));
  
  // Update each dimension using EMA
  const updatedPreferences = {};
  
  for (const dimension in FEATURE_DIMENSIONS) {
    const currentValue = currentPreferences[dimension] || 0;
    const movieValue = movieFeatures[dimension] || 0;
    
    // EMA update: new = old + learningRate * weight * (movie - old)
    const update = effectiveLearningRate * gestureWeight * (movieValue - currentValue);
    updatedPreferences[dimension] = Math.max(-1, Math.min(1, currentValue + update));
  }
  
  return {
    preferences: updatedPreferences,
    metadata: {
      gestureWeight,
      effectiveLearningRate,
      update: updatedPreferences
    }
  };
}

// ===== EXPLORATION STRATEGY =====
// Balance exploitation vs exploration

/**
 * Determine exploration rate based on user interaction history
 * @param {number} totalInteractions - Total number of user interactions
 * @param {number} likeRatio - Ratio of positive interactions
 * @param {number} baseExplorationRate - Base exploration rate
 * @returns {number} Adjusted exploration rate
 */
function calculateExplorationRate(totalInteractions, likeRatio, baseExplorationRate = 0.15) {
  // Start with higher exploration for new users
  const newUserBonus = Math.max(0, (50 - totalInteractions) / 50) * 0.1;
  
  // Adjust based on like ratio (if too high or too low, increase exploration)
  const optimalLikeRatio = 0.5; // 50% is ideal
  const likeRatioDeviation = Math.abs(likeRatio - optimalLikeRatio);
  const likeRatioAdjustment = likeRatioDeviation * 0.2;
  
  // Final exploration rate
  const explorationRate = Math.min(0.3, baseExplorationRate + newUserBonus + likeRatioAdjustment);
  
  return explorationRate;
}

// ===== GENRE MAPPING =====
// Map TMDB genre IDs to our feature dimensions
const GENRE_ID_MAPPING = {
  28: 'genre_action',    // Action
  12: 'genre_action',    // Adventure
  35: 'genre_comedy',    // Comedy
  18: 'genre_drama',     // Drama
  27: 'genre_horror',    // Horror
  10749: 'genre_romance', // Romance
  878: 'genre_scifi',    // Science Fiction
  14: 'genre_scifi',     // Fantasy
  53: 'genre_action',    // Thriller
  80: 'genre_action',    // Crime
  9648: 'genre_drama',   // Mystery
  10752: 'genre_action', // War
  37: 'genre_action',    // Western
  36: 'genre_drama',     // History
  10402: 'genre_drama',  // Music
  10751: 'genre_comedy', // Family
  16: 'genre_comedy',    // Animation
  99: 'genre_drama',     // Documentary
  10770: 'genre_drama'   // TV Movie
};

/**
 * Convert movie data to feature vector
 * @param {Object} movie - Movie document from Firestore
 * @returns {Object} Feature vector
 */
function movieToFeatureVector(movie) {
  const features = initializeUserPreferenceVector();
  
  // 1. Process genres
  if (movie.genreIds && Array.isArray(movie.genreIds)) {
    const genreCounts = {};
    
    // Count genre occurrences
    movie.genreIds.forEach(genreId => {
      const dimension = GENRE_ID_MAPPING[genreId];
      if (dimension) {
        genreCounts[dimension] = (genreCounts[dimension] || 0) + 1;
      }
    });
    
    // Normalize genre strengths
    const totalGenres = movie.genreIds.length || 1;
    for (const dimension in genreCounts) {
      features[dimension] = genreCounts[dimension] / totalGenres;
    }
  }
  
  // 2. Normalize popularity (assume max popularity of 1000)
  features.popularity_normalized = Math.min(1, (movie.popularity || 0) / 1000);
  
  // 3. Calculate recency score (movies within last 2 years get higher score)
  const releaseDate = new Date(movie.releaseDate);
  const currentDate = new Date();
  const yearsDiff = (currentDate - releaseDate) / (365 * 24 * 60 * 60 * 1000);
  features.recency_score = Math.max(0, Math.min(1, 1 - (yearsDiff / 10)));
  
  // 4. Normalize rating
  features.rating_normalized = (movie.voteAverage || 0) / 10;
  
  return features;
}

// ===== EXAMPLE CALCULATIONS =====

// Example 1: User likes an action movie
const examplePreferences = {
  genre_action: 0.3,
  genre_comedy: 0.1,
  genre_drama: -0.2,
  genre_horror: -0.5,
  genre_romance: 0.0,
  genre_scifi: 0.4,
  popularity_normalized: 0.2,
  recency_score: 0.3,
  rating_normalized: 0.5
};

const exampleMovie = {
  genre_action: 0.8,
  genre_comedy: 0.2,
  genre_drama: 0.0,
  genre_horror: 0.0,
  genre_romance: 0.0,
  genre_scifi: 0.0,
  popularity_normalized: 0.7,
  recency_score: 0.9,
  rating_normalized: 0.75
};

// Calculate score
const scoreResult = calculateRecommendationScore(examplePreferences, exampleMovie);
console.log('Example Score Calculation:', scoreResult);
// Expected: High score due to action genre match and high ratings

// Update preferences after "liked" action
const updateResult = updateUserPreferences(examplePreferences, exampleMovie, 'liked', 0.1, 50);
console.log('Updated Preferences:', updateResult);

// ===== MODEL CONFIDENCE =====
/**
 * Calculate model confidence based on interaction history
 * @param {number} totalInteractions - Total interactions
 * @returns {number} Confidence score (0-1)
 */
function calculateModelConfidence(totalInteractions) {
  // Confidence grows logarithmically with interactions
  // Reaches 0.5 at 20 interactions, 0.8 at 100 interactions
  return Math.min(1, Math.log10(totalInteractions + 1) / 2.5);
}

module.exports = {
  GESTURE_WEIGHTS,
  FEATURE_DIMENSIONS,
  GENRE_ID_MAPPING,
  initializeUserPreferenceVector,
  calculateRecommendationScore,
  updateUserPreferences,
  calculateExplorationRate,
  movieToFeatureVector,
  calculateModelConfidence
};
