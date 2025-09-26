const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://your-project-id.firebaseio.com"
  });
}

const db = admin.firestore();

// Import the scoring system
const scoringSystem = require('./scoring-system.js');

async function fixMovieFeatures() {
  console.log('🔧 Fixing movie feature vectors...');
  
  try {
    // Get all movies from the database
    const moviesSnapshot = await db.collection('movies').get();
    
    if (moviesSnapshot.empty) {
      console.log('❌ No movies found in database');
      return;
    }
    
    console.log(`📽️  Found ${moviesSnapshot.size} movies`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process movies in batches
    const batch = db.batch();
    let batchCount = 0;
    const batchSize = 500;
    
    for (const doc of moviesSnapshot.docs) {
      const movie = doc.data();
      
      // Skip if already has feature vector
      if (movie.featureVector) {
        continue;
      }
      
      try {
        // Generate feature vector using the scoring system
        const featureVector = scoringSystem.movieToFeatureVector(movie);
        
        // Update the movie document
        batch.update(doc.ref, {
          featureVector: featureVector,
          updatedAt: admin.firestore.Timestamp.now()
        });
        
        updatedCount++;
        batchCount++;
        
        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`✅ Updated batch of ${batchCount} movies`);
          batchCount = 0;
        }
        
      } catch (error) {
        console.error(`❌ Error processing movie ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Updated final batch of ${batchCount} movies`);
    }
    
    console.log(`\n🎉 Feature vector update complete!`);
    console.log(`✅ Updated: ${updatedCount} movies`);
    console.log(`❌ Errors: ${errorCount} movies`);
    
    if (updatedCount > 0) {
      console.log(`\n🚀 Now you can generate recommendations!`);
      console.log(`   Run: firebase functions:shell`);
      console.log(`   Then: generateInitialRecommendations({selectedCategories: ['action', 'comedy']})`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing movie features:', error);
  }
}

// Run the function
fixMovieFeatures()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
