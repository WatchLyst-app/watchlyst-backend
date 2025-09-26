import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Import scoring system
const scoringSystem = require('../../scoring-system.js');

const db = admin.firestore();

// ===== CLOUD FUNCTION 1: Process Swipe Interaction =====
export const processSwipeInteraction = functions.firestore
  .document('interactions/{interactionId}')
  .onCreate(async (snap, context) => {
    const interaction = snap.data();
    const { userId, movieId, action } = interaction;
    
    console.log(`Processing ${action} interaction for user ${userId} on movie ${movieId}`);
    
    try {
      // 1. Get current user preferences
      const userPrefRef = db.collection('userPreferences').doc(userId);
      const userPrefDoc = await userPrefRef.get();
      
      let currentPreferences = scoringSystem.initializeUserPreferenceVector();
      let learningMetadata = {
        learningRate: 0.1,
        decayFactor: 0.95,
        totalUpdates: 0,
        modelConfidence: 0
      };
      
      if (userPrefDoc.exists) {
        const data = userPrefDoc.data()!;
        currentPreferences = data.preferenceVector || currentPreferences;
        learningMetadata = data.learningMetadata || learningMetadata;
      }
      
      // 2. Get movie features
      const movieDoc = await db.collection('movies').doc(movieId).get();
      if (!movieDoc.exists) {
        console.error(`Movie ${movieId} not found`);
        return;
      }
      
      const movie = movieDoc.data()!;
      let movieFeatures = movie.featureVector;
      
      // Generate feature vector if missing
      if (!movieFeatures) {
        movieFeatures = scoringSystem.movieToFeatureVector(movie);
        // Update movie with feature vector
        await movieDoc.ref.update({ 
          featureVector: movieFeatures,
          updatedAt: admin.firestore.Timestamp.now()
        });
      }
      
      // 3. Calculate scores before update
      const scoreBefore = scoringSystem.calculateRecommendationScore(
        currentPreferences, 
        movieFeatures
      );
      
      // 4. Update preferences
      const updateResult = scoringSystem.updateUserPreferences(
        currentPreferences,
        movieFeatures,
        action,
        learningMetadata.learningRate,
        learningMetadata.totalUpdates
      );
      
      // 5. Calculate scores after update
      const scoreAfter = scoringSystem.calculateRecommendationScore(
        updateResult.preferences,
        movieFeatures
      );
      
      // 6. Update user preferences in Firestore
      learningMetadata.totalUpdates += 1;
      learningMetadata.modelConfidence = scoringSystem.calculateModelConfidence(
        learningMetadata.totalUpdates
      );
      
      await userPrefRef.set({
        userId,
        preferenceVector: updateResult.preferences,
        learningMetadata,
        updatedAt: admin.firestore.Timestamp.now()
      }, { merge: true });
      
      // 7. Update interaction with scoring data
      await snap.ref.update({
        scoringData: {
          baseScore: scoreBefore.baseScore,
          gestureWeight: scoringSystem.GESTURE_WEIGHTS[action],
          explorationBonus: 0,
          finalScore: scoreAfter.finalScore,
          preferenceVectorBefore: currentPreferences,
          preferenceVectorAfter: updateResult.preferences
        }
      });
      
      // 8. Update user stats
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const stats = userDoc.data()!.stats || {};
        const swipesByAction = stats.swipesByAction || {};
        
        swipesByAction[action] = (swipesByAction[action] || 0) + 1;
        const totalSwipes = stats.totalSwipes + 1 || 1;
        
        // Calculate like ratio
        const positiveActions = (swipesByAction.loved || 0) + (swipesByAction.liked || 0);
        const likeRatio = totalSwipes > 0 ? positiveActions / totalSwipes : 0;
        
        await userRef.update({
          'stats.totalSwipes': totalSwipes,
          'stats.likeRatio': likeRatio,
          'stats.lastSwipeAt': admin.firestore.Timestamp.now(),
          [`stats.swipesByAction.${action}`]: swipesByAction[action]
        });
        
        // 9. Check if we need to refresh recommendations
        if (totalSwipes % 5 === 0) {
          console.log(`Triggering recommendation refresh for user ${userId}`);
          await refreshUserRecommendations(userId);
        }
      }
      
      // 10. Update movie recommendation data
      await movieDoc.ref.update({
        'recommendationData.totalInteractions': admin.firestore.FieldValue.increment(1),
        'recommendationData.positiveInteractions': ['loved', 'liked'].includes(action) 
          ? admin.firestore.FieldValue.increment(1) 
          : admin.firestore.FieldValue.increment(0),
        'recommendationData.lastInteractionAt': admin.firestore.Timestamp.now()
      });
      
      console.log(`Successfully processed ${action} interaction for user ${userId}`);
      
    } catch (error) {
      console.error('Error processing interaction:', error);
      throw error;
    }
  });

// ===== CLOUD FUNCTION 2: Generate Initial Recommendations =====
export const generateInitialRecommendations = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const userId = context.auth.uid;
    const selectedCategories = data.selectedCategories || [];
    
    console.log(`Generating initial recommendations for user ${userId}`);
    console.log(`Selected categories: ${selectedCategories.join(', ')}`);
    
    try {
      // 1. Initialize user preferences
      const userPrefRef = db.collection('userPreferences').doc(userId);
      const initialPreferences = scoringSystem.initializeUserPreferenceVector();
      
      // Boost preferences for selected categories
      selectedCategories.forEach((category: string) => {
        const genreKey = `genre_${category.toLowerCase()}`;
        if (initialPreferences.hasOwnProperty(genreKey)) {
          initialPreferences[genreKey] = 0.5; // Initial boost
        }
      });
      
      await userPrefRef.set({
        userId,
        preferenceVector: initialPreferences,
        learningMetadata: {
          learningRate: 0.1,
          decayFactor: 0.95,
          totalUpdates: 0,
          modelConfidence: 0
        },
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      // 2. Get all movies
      const moviesSnapshot = await db.collection('movies')
        .orderBy('popularity', 'desc')
        .limit(500)
        .get();
      
      const allMovies: any[] = [];
      moviesSnapshot.forEach(doc => {
        allMovies.push({ id: doc.id, ...doc.data() });
      });
      
      // 3. Score and categorize movies
      const scoredMovies = allMovies.map(movie => {
        // Ensure movie has feature vector
        let features = movie.featureVector;
        if (!features) {
          features = scoringSystem.movieToFeatureVector(movie);
        }
        
        // Calculate base score
        const scoreResult = scoringSystem.calculateRecommendationScore(
          initialPreferences,
          features
        );
        
        // Determine reason for recommendation
        let reason = 'exploration';
        let bonusScore = 0;
        
        // Category match bonus
        if (movie.genres && Array.isArray(movie.genres)) {
          const hasSelectedGenre = movie.genres.some((genre: string) => 
            selectedCategories.some((cat: string) => 
              genre.toLowerCase().includes(cat.toLowerCase())
            )
          );
          if (hasSelectedGenre) {
            reason = 'category_match';
            bonusScore = 0.5;
          }
        }
        
        // Trending bonus (high popularity + recent)
        if (movie.popularity > 100 && movie.voteAverage > 7) {
          if (reason === 'exploration') {
            reason = 'trending';
            bonusScore = 0.3;
          }
        }
        
        return {
          movieId: movie.id,
          movie,
          score: scoreResult.finalScore + bonusScore,
          reason,
          scoreDetails: scoreResult
        };
      });
      
      // 4. Sort by score and select top movies
      scoredMovies.sort((a, b) => b.score - a.score);
      
      // 5. Build recommendation queue with balanced distribution
      const queue: any[] = [];
      const targetDistribution = {
        category_match: Math.floor(50 * 0.6),  // 60%
        trending: Math.floor(50 * 0.25),       // 25%
        exploration: Math.floor(50 * 0.15)      // 15%
      };
      
      const addedMovies = new Set();
      
      // Add movies by reason
      for (const reason of ['category_match', 'trending', 'exploration']) {
        const targetCount = targetDistribution[reason as keyof typeof targetDistribution];
        let added = 0;
        
        for (const item of scoredMovies) {
          if (item.reason === reason && !addedMovies.has(item.movieId) && added < targetCount) {
            queue.push({
              movieId: item.movieId,
              score: item.score,
              reason: item.reason,
              position: queue.length
            });
            addedMovies.add(item.movieId);
            added++;
          }
        }
      }
      
      // Fill remaining slots with highest scored movies
      for (const item of scoredMovies) {
        if (!addedMovies.has(item.movieId) && queue.length < 50) {
          queue.push({
            movieId: item.movieId,
            score: item.score,
            reason: 'preference_match',
            position: queue.length
          });
          addedMovies.add(item.movieId);
        }
      }
      
      // 6. Save recommendations
      const recommendationsRef = db.collection('recommendations').doc(userId);
      await recommendationsRef.set({
        userId,
        queue,
        metadata: {
          generatedAt: admin.firestore.Timestamp.now(),
          algorithm: 'collaborative_content_v1',
          totalMoviesScored: scoredMovies.length,
          averageScore: scoredMovies.reduce((sum, item) => sum + item.score, 0) / scoredMovies.length,
          explorationRate: 0.15
        },
        nextRefresh: {
          afterSwipes: 5,
          scheduledAt: null
        },
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      console.log(`Generated ${queue.length} initial recommendations for user ${userId}`);
      
      return {
        success: true,
        recommendationCount: queue.length,
        distribution: {
          category_match: queue.filter(r => r.reason === 'category_match').length,
          trending: queue.filter(r => r.reason === 'trending').length,
          exploration: queue.filter(r => r.reason === 'exploration').length,
          preference_match: queue.filter(r => r.reason === 'preference_match').length
        }
      };
      
    } catch (error) {
      console.error('Error generating initial recommendations:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate recommendations'
      );
    }
  }
);

// ===== CLOUD FUNCTION 3: Refresh Recommendations =====
async function refreshUserRecommendations(userId: string) {
  console.log(`Refreshing recommendations for user ${userId}`);
  
  try {
    // 1. Get user preferences and stats
    const userPrefDoc = await db.collection('userPreferences').doc(userId).get();
    if (!userPrefDoc.exists) {
      console.error(`User preferences not found for ${userId}`);
      return;
    }
    
    const userPreferences = userPrefDoc.data()!.preferenceVector;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userStats = userDoc.exists ? userDoc.data()!.stats : {};
    
    // 2. Calculate dynamic exploration rate
    const explorationRate = scoringSystem.calculateExplorationRate(
      userStats.totalSwipes || 0,
      userStats.likeRatio || 0.5,
      0.15
    );
    
    // 3. Get user's interaction history
    const interactionsSnapshot = await db.collection('interactions')
      .where('userId', '==', userId)
      .get();
    
    const seenMovies = new Set();
    interactionsSnapshot.forEach(doc => {
      seenMovies.add(doc.data().movieId);
    });
    
    // 4. Get unseen movies
    const moviesSnapshot = await db.collection('movies')
      .orderBy('popularity', 'desc')
      .limit(1000)
      .get();
    
    const unseenMovies: any[] = [];
    moviesSnapshot.forEach(doc => {
      if (!seenMovies.has(doc.id)) {
        unseenMovies.push({ id: doc.id, ...doc.data() });
      }
    });
    
    // 5. Score all unseen movies
    const scoredMovies = unseenMovies.map(movie => {
      // Ensure movie has feature vector
      let features = movie.featureVector;
      if (!features) {
        features = scoringSystem.movieToFeatureVector(movie);
      }
      
      // Determine if this is an exploration movie
      const isExploration = Math.random() < explorationRate;
      
      // Calculate score
      const scoreResult = scoringSystem.calculateRecommendationScore(
        userPreferences,
        features,
        explorationRate,
        isExploration
      );
      
      // Determine recommendation reason
      let reason = 'preference_match';
      if (isExploration) {
        reason = 'exploration';
      } else if (movie.popularity > 200 && movie.voteAverage > 7.5) {
        reason = 'trending';
      }
      
      return {
        movieId: movie.id,
        score: scoreResult.finalScore,
        reason,
        scoreDetails: scoreResult
      };
    });
    
    // 6. Sort by score and create queue
    scoredMovies.sort((a, b) => b.score - a.score);
    
    const queue = scoredMovies.slice(0, 50).map((item, index) => ({
      movieId: item.movieId,
      score: item.score,
      reason: item.reason,
      position: index
    }));
    
    // 7. Update recommendations
    await db.collection('recommendations').doc(userId).set({
      userId,
      queue,
      metadata: {
        generatedAt: admin.firestore.Timestamp.now(),
        algorithm: 'collaborative_content_v1',
        totalMoviesScored: scoredMovies.length,
        averageScore: scoredMovies.slice(0, 50).reduce((sum, item) => sum + item.score, 0) / 50,
        explorationRate
      },
      nextRefresh: {
        afterSwipes: 5,
        scheduledAt: null
      },
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`Refreshed recommendations for user ${userId}: ${queue.length} movies`);
    
  } catch (error) {
    console.error('Error refreshing recommendations:', error);
    throw error;
  }
}

// Export for callable function
export const refreshRecommendations = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const userId = context.auth.uid;
    
    try {
      await refreshUserRecommendations(userId);
      
      return {
        success: true,
        message: 'Recommendations refreshed successfully'
      };
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to refresh recommendations'
      );
    }
  }
);

// ===== HELPER FUNCTION: Get User Scoring Details =====
export const getUserScoringDetails = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const userId = context.auth.uid;
    
    try {
      // Get last interaction
      const lastInteraction = await db.collection('interactions')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (lastInteraction.empty) {
        return { hasData: false };
      }
      
      const interaction = lastInteraction.docs[0].data();
      
      // Get user preferences
      const userPrefDoc = await db.collection('userPreferences').doc(userId).get();
      const preferences = userPrefDoc.exists ? userPrefDoc.data() : null;
      
      // Get user stats
      const userDoc = await db.collection('users').doc(userId).get();
      const stats = userDoc.exists ? userDoc.data()!.stats : null;
      
      return {
        hasData: true,
        lastInteraction: interaction,
        preferences,
        stats
      };
      
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get scoring details'
      );
    }
  }
);

// ===== HELPER FUNCTION: Populate Movie Features =====
export const populateMovieFeatures = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    console.log('Populating movie feature vectors...');
    
    try {
      const moviesSnapshot = await db.collection('movies')
        .where('featureVector', '==', null)
        .limit(100)
        .get();

      if (moviesSnapshot.empty) {
        return {
          success: true,
          message: 'All movies already have feature vectors',
          updatedCount: 0
        };
      }

      const batch = db.batch();
      let updatedCount = 0;

      moviesSnapshot.forEach(doc => {
        const movie = doc.data();
        const features = scoringSystem.movieToFeatureVector(movie);
        
        batch.update(doc.ref, {
          featureVector: features,
          updatedAt: admin.firestore.Timestamp.now()
        });
        
        updatedCount++;
      });

      await batch.commit();
      
      console.log(`Updated feature vectors for ${updatedCount} movies`);
      
      return {
        success: true,
        message: `Updated ${updatedCount} movies with feature vectors`,
        updatedCount
      };
      
    } catch (error) {
      console.error('Error populating movie features:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to populate movie features'
      );
    }
  }
);

// ===== SCHEDULED FUNCTION: Update Movie Features =====
export const updateMovieFeatures = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    console.log('Updating movie feature vectors...');
    
    const batch = db.batch();
    let updateCount = 0;
    
    try {
      const moviesSnapshot = await db.collection('movies')
        .where('featureVector', '==', null)
        .limit(100)
        .get();
      
      moviesSnapshot.forEach(doc => {
        const movie = doc.data();
        const features = scoringSystem.movieToFeatureVector(movie);
        
        batch.update(doc.ref, {
          featureVector: features,
          updatedAt: admin.firestore.Timestamp.now()
        });
        
        updateCount++;
      });
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`Updated feature vectors for ${updateCount} movies`);
      } else {
        console.log('No movies need feature vector updates');
      }
      
    } catch (error) {
      console.error('Error updating movie features:', error);
    }
  });
