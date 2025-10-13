# WatchLyst Recommendation System Documentation

## Overview

The WatchLyst Recommendation System is a sophisticated machine learning-based movie recommendation engine that learns from user preferences and provides personalized movie suggestions.

## Architecture

### Components

1. **Scoring System** (`scoring-system.js`)
   - Gesture-based scoring (Loved: +3.0, Liked: +1.5, Seen: 0.0, Disliked: -2.5)
   - 9-dimensional feature vectors for movies
   - User preference learning with Exponential Moving Average (EMA)
   - Exploration vs exploitation strategy

2. **Cloud Functions** (`functions/src/recommendations.ts`)
   - `processSwipeInteraction`: Processes each swipe and updates preferences
   - `generateInitialRecommendations`: Creates initial recommendation queue
   - `refreshRecommendations`: Updates recommendations based on learning
   - `populateMovieFeatures`: Batch processes movie feature vectors

3. **Frontend Integration** (Flutter)
   - `RecommendationService`: Service for interacting with backend
   - Category mapping system
   - Onboarding flow with category selection
   - Real-time preference tracking

## Features

### 1. Gesture-Based Learning
Each user gesture has a specific weight that influences the recommendation algorithm:

| Gesture | Action | Weight | Effect |
|---------|--------|--------|--------|
| Double Tap | Loved | +3.0 | Strong positive signal |
| Swipe Up | Liked | +1.5 | Moderate positive signal |
| Swipe Right | Seen | 0.0 | Neutral signal |
| Swipe Left | Not Seen | 0.0 | Neutral signal |
| Swipe Down | Disliked | -2.5 | Strong negative signal |

### 2. Multi-Dimensional Feature Space
Movies and user preferences are represented in a 9-dimensional space:

**Genre Dimensions (6):**
- Action
- Comedy
- Drama
- Horror
- Romance
- Sci-Fi

**Content Dimensions (3):**
- Popularity (normalized 0-1)
- Recency (how recent the movie is)
- Rating (normalized vote average)

### 3. Adaptive Learning
- **Learning Rate Decay**: Learning rate decreases as user interacts more
- **Model Confidence**: Increases logarithmically with interaction count
- **Exploration Rate**: Dynamically adjusted based on user behavior

### 4. Recommendation Strategies

**Initial Recommendations:**
- 60% Category Match (from onboarding)
- 25% Trending Movies
- 15% Exploration

**Ongoing Recommendations:**
- Preference-based scoring
- Dynamic exploration rate
- Filtered to exclude seen movies

## Deployment

### Prerequisites

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init
```

### 1. Deploy Cloud Functions

```bash
cd watchlyst_backend/functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:processSwipeInteraction
firebase deploy --only functions:generateInitialRecommendations
firebase deploy --only functions:refreshRecommendations
```

### 2. Deploy Firestore Rules

```bash
cd watchlyst_backend

# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

### 3. Deploy Firestore Indexes

The system requires these composite indexes (defined in `firestore.indexes.json`):

1. `interactions` collection: userId (ASC) + timestamp (DESC)
2. `interactions` collection: userId (ASC) + movieId (ASC)
3. `movies` collection: popularity (DESC) + voteAverage (DESC)

## Testing

### 1. Test Backend Connection

```bash
# From Flutter app
flutter run
# Check console for "Backend connection test: SUCCESS"
```

### 2. Test Initial Recommendations

```dart
// In your Flutter app
final recommendationService = RecommendationService();
final result = await recommendationService.generateInitialRecommendations(
  ['action', 'scifi', 'comedy']
);
print('Generated: ${result['recommendationCount']} recommendations');
```

### 3. Test Swipe Tracking

```dart
// Track a swipe
await recommendationService.trackInteraction(
  movieId: '550',
  action: 'liked',
);
```

### 4. Check User Preferences

```dart
final preferences = await recommendationService.getCurrentPreferences();
print('Model confidence: ${preferences?.learningMetadata.modelConfidence}');
print('Preference vector: ${preferences?.preferenceVector}');
```

## Performance Optimization

### 1. Caching Strategy

- **Recommendation Cache**: 1 hour TTL
- **Preference Cache**: 5 minutes TTL
- **Movie Features**: 24 hours TTL

### 2. Batch Processing

- Maximum batch size: 500 interactions
- Batch interval: 5 seconds
- Concurrent batches: 3

### 3. Query Optimization

- Maximum movies scored: 1000
- Page size: 100
- Query result caching enabled

### 4. Memory Management

- LRU cache implementation
- Automatic cache eviction at 80% memory usage
- Garbage collection hints

## Security

### Firestore Security Rules

1. **Users**: Can only read/write their own data
2. **Movies**: Public read, admin-only write
3. **UserPreferences**: Private to user, Cloud Functions only write
4. **Interactions**: Users can create/read own, immutable
5. **Recommendations**: Read-only for users, Cloud Functions only write

### Authentication

All Cloud Functions use Firebase Authentication:
```typescript
if (!context.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
}
```

## Monitoring

### Performance Metrics

Track these key metrics:

1. **Recommendation Generation Time**: Should be < 2 seconds
2. **Interaction Processing Time**: Should be < 500ms
3. **Model Confidence**: Track average confidence across users
4. **Cache Hit Rate**: Should be > 80%

### Cloud Functions Logs

```bash
# View logs
firebase functions:log

# Filter by function
firebase functions:log --only generateInitialRecommendations

# Follow logs in real-time
firebase functions:log --follow
```

### Debugging

Enable debug mode in Flutter app:
```dart
final recommendationService = RecommendationService();
final scoringDetails = await recommendationService.getScoringDetails();
print(scoringDetails);
```

## Troubleshooting

### Common Issues

1. **"Feature vector missing" error**
   ```dart
   // Populate feature vectors
   await recommendationService.populateMovieFeatures();
   ```

2. **No recommendations generated**
   - Check if user has completed onboarding
   - Verify movies exist in Firestore
   - Check Cloud Function logs

3. **Slow recommendation generation**
   - Check query indexes are deployed
   - Review Cloud Function memory allocation
   - Enable caching

4. **Authentication errors**
   - Verify user is logged in
   - Check Firestore security rules
   - Ensure Firebase Auth is initialized

## API Reference

### Cloud Functions

#### `generateInitialRecommendations`
```typescript
interface Request {
  selectedCategories: string[];
}

interface Response {
  success: boolean;
  recommendationCount: number;
  distribution: {
    category_match: number;
    trending: number;
    exploration: number;
    preference_match: number;
  };
}
```

#### `refreshRecommendations`
```typescript
interface Response {
  success: boolean;
  message: string;
}
```

#### `getUserScoringDetails`
```typescript
interface Response {
  hasData: boolean;
  lastInteraction?: Interaction;
  preferences?: UserPreferences;
  stats?: UserStats;
}
```

## Algorithm Details

### Scoring Formula

```
score = dotProduct(userPreferences, movieFeatures) / dimensionCount + explorationBonus
```

### Learning Update

```
newPreference[i] = oldPreference[i] + learningRate * gestureWeight * (movieFeature[i] - oldPreference[i])
```

### Exploration Rate

```
explorationRate = baseRate + newUserBonus + likeRatioAdjustment
```

Where:
- `newUserBonus = max(0, (50 - totalInteractions) / 50) * 0.1`
- `likeRatioAdjustment = abs(likeRatio - 0.5) * 0.2`

## Future Enhancements

1. **Collaborative Filtering**: User-to-user similarity
2. **Temporal Patterns**: Time-based recommendations
3. **A/B Testing**: Multiple algorithm variants
4. **Cold Start Improvements**: Better initial recommendations
5. **Multi-Modal Features**: Include cast, director, etc.
6. **Real-time Updates**: WebSocket-based updates
7. **Offline Support**: Local recommendation queue

## Support

For issues or questions:
1. Check Cloud Function logs
2. Enable debug mode in app
3. Review Firestore security rules
4. Verify all indexes are deployed

## License

Proprietary - WatchLyst App


