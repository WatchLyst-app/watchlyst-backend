#!/usr/bin/env node

/**
 * Test script for WatchLyst Recommendation System
 * Run with: node test-recommendations.js
 */

const scoringSystem = require('./scoring-system.js');

console.log('🎬 WatchLyst Recommendation System - Unit Tests');
console.log('================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('✅', message);
    testsPassed++;
  } else {
    console.log('❌', message);
    testsFailed++;
  }
}

// Test 1: Gesture Weights
console.log('Test 1: Gesture Weights');
assert(scoringSystem.GESTURE_WEIGHTS.loved === 3.0, 'Loved gesture weight is 3.0');
assert(scoringSystem.GESTURE_WEIGHTS.liked === 1.5, 'Liked gesture weight is 1.5');
assert(scoringSystem.GESTURE_WEIGHTS.seen === 0.0, 'Seen gesture weight is 0.0');
assert(scoringSystem.GESTURE_WEIGHTS.disliked === -2.5, 'Disliked gesture weight is -2.5');
console.log('');

// Test 2: Initialize User Preference Vector
console.log('Test 2: Initialize User Preference Vector');
const preferences = scoringSystem.initializeUserPreferenceVector();
assert(Object.keys(preferences).length === 9, 'Preference vector has 9 dimensions');
assert(preferences.genre_action === 0, 'Initial action preference is 0');
console.log('');

// Test 3: Movie Feature Vector Conversion
console.log('Test 3: Movie Feature Vector Conversion');
const testMovie = {
  genreIds: [28, 878], // Action + Sci-Fi
  popularity: 500,
  releaseDate: '2024-01-01',
  voteAverage: 8.0
};
const features = scoringSystem.movieToFeatureVector(testMovie);
assert(features.genre_action > 0, 'Action genre is detected');
assert(features.genre_scifi > 0, 'Sci-Fi genre is detected');
assert(features.popularity_normalized >= 0 && features.popularity_normalized <= 1, 'Popularity is normalized');
assert(features.rating_normalized === 0.8, 'Rating is normalized correctly (8.0/10 = 0.8)');
console.log('');

// Test 4: Recommendation Score Calculation
console.log('Test 4: Recommendation Score Calculation');
const userPrefs = {
  genre_action: 0.8,
  genre_comedy: 0.1,
  genre_drama: -0.2,
  genre_horror: -0.5,
  genre_romance: 0.0,
  genre_scifi: 0.7,
  popularity_normalized: 0.3,
  recency_score: 0.4,
  rating_normalized: 0.6
};

const movieFeatures = {
  genre_action: 0.9,
  genre_comedy: 0.0,
  genre_drama: 0.0,
  genre_horror: 0.0,
  genre_romance: 0.0,
  genre_scifi: 0.8,
  popularity_normalized: 0.8,
  recency_score: 0.9,
  rating_normalized: 0.85
};

const scoreResult = scoringSystem.calculateRecommendationScore(userPrefs, movieFeatures);
assert(scoreResult.finalScore > 0, 'Score is positive for matching preferences');
assert(scoreResult.baseScore !== undefined, 'Base score is calculated');
console.log(`  Score: ${scoreResult.finalScore.toFixed(3)}`);
console.log('');

// Test 5: Preference Update
console.log('Test 5: Preference Update');
const currentPrefs = {
  genre_action: 0.3,
  genre_comedy: 0.1,
  genre_drama: 0.0,
  genre_horror: 0.0,
  genre_romance: 0.0,
  genre_scifi: 0.2,
  popularity_normalized: 0.1,
  recency_score: 0.1,
  rating_normalized: 0.3
};

const updateResult = scoringSystem.updateUserPreferences(
  currentPrefs,
  movieFeatures,
  'liked',
  0.1,
  10
);

assert(updateResult.preferences.genre_action > currentPrefs.genre_action, 
  'Action preference increased after liking action movie');
assert(updateResult.metadata.gestureWeight === 1.5, 'Gesture weight is correct for liked');
console.log('');

// Test 6: Exploration Rate
console.log('Test 6: Exploration Rate Calculation');
const explorationRate1 = scoringSystem.calculateExplorationRate(5, 0.5, 0.15);
const explorationRate2 = scoringSystem.calculateExplorationRate(100, 0.5, 0.15);
assert(explorationRate1 > explorationRate2, 'Exploration rate is higher for new users');
console.log(`  New user (5 interactions): ${explorationRate1.toFixed(3)}`);
console.log(`  Experienced user (100 interactions): ${explorationRate2.toFixed(3)}`);
console.log('');

// Test 7: Model Confidence
console.log('Test 7: Model Confidence');
const confidence1 = scoringSystem.calculateModelConfidence(10);
const confidence2 = scoringSystem.calculateModelConfidence(100);
assert(confidence2 > confidence1, 'Confidence increases with more interactions');
assert(confidence2 <= 1.0, 'Confidence is capped at 1.0');
console.log(`  After 10 interactions: ${confidence1.toFixed(3)}`);
console.log(`  After 100 interactions: ${confidence2.toFixed(3)}`);
console.log('');

// Test 8: Genre Mapping
console.log('Test 8: Genre Mapping');
assert(scoringSystem.GENRE_ID_MAPPING[28] === 'genre_action', 'Action genre mapped correctly');
assert(scoringSystem.GENRE_ID_MAPPING[35] === 'genre_comedy', 'Comedy genre mapped correctly');
assert(scoringSystem.GENRE_ID_MAPPING[878] === 'genre_scifi', 'Sci-Fi genre mapped correctly');
console.log('');

// Test 9: Preference Vector Bounds
console.log('Test 9: Preference Vector Bounds');
const extremeFeatures = {
  genre_action: 1.0,
  genre_comedy: 0.0,
  genre_drama: 0.0,
  genre_horror: 0.0,
  genre_romance: 0.0,
  genre_scifi: 0.0,
  popularity_normalized: 1.0,
  recency_score: 1.0,
  rating_normalized: 1.0
};

// Love it 10 times
let prefs = scoringSystem.initializeUserPreferenceVector();
for (let i = 0; i < 10; i++) {
  const result = scoringSystem.updateUserPreferences(prefs, extremeFeatures, 'loved', 0.1, i);
  prefs = result.preferences;
}

assert(prefs.genre_action <= 1.0, 'Preferences are bounded to [-1, 1]');
assert(prefs.genre_action >= -1.0, 'Preferences are bounded to [-1, 1]');
console.log(`  Action preference after 10 loves: ${prefs.genre_action.toFixed(3)}`);
console.log('');

// Test 10: Integration Test
console.log('Test 10: Full Recommendation Flow');
const initialPrefs = scoringSystem.initializeUserPreferenceVector();
const movies = [
  {
    genreIds: [28, 12], // Action/Adventure
    popularity: 800,
    releaseDate: '2023-06-15',
    voteAverage: 8.5
  },
  {
    genreIds: [35, 10749], // Comedy/Romance
    popularity: 400,
    releaseDate: '2022-03-20',
    voteAverage: 7.2
  },
  {
    genreIds: [27, 53], // Horror/Thriller
    popularity: 300,
    releaseDate: '2023-10-31',
    voteAverage: 6.8
  }
];

// Simulate user liking action movies and disliking horror
let testUserPrefs = initialPrefs;
const actionFeatures = scoringSystem.movieToFeatureVector(movies[0]);
const horrorFeatures = scoringSystem.movieToFeatureVector(movies[2]);

testUserPrefs = scoringSystem.updateUserPreferences(testUserPrefs, actionFeatures, 'loved', 0.1, 1).preferences;
testUserPrefs = scoringSystem.updateUserPreferences(testUserPrefs, horrorFeatures, 'disliked', 0.1, 2).preferences;

// Score all movies
const scores = movies.map(movie => {
  const features = scoringSystem.movieToFeatureVector(movie);
  return scoringSystem.calculateRecommendationScore(testUserPrefs, features);
});

assert(scores[0].finalScore > scores[2].finalScore, 
  'Action movie scores higher than horror after user preferences');
console.log(`  Action movie score: ${scores[0].finalScore.toFixed(3)}`);
console.log(`  Comedy movie score: ${scores[1].finalScore.toFixed(3)}`);
console.log(`  Horror movie score: ${scores[2].finalScore.toFixed(3)}`);
console.log('');

// Summary
console.log('================================================');
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed! The recommendation system is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}

