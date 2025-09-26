const admin = require('firebase-admin');

// Initialize Firebase Admin (this will use default credentials)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test 1: Check if we can connect
    console.log('✅ Firebase Admin initialized');
    
    // Test 2: Check movies collection
    console.log('\n📽️  Checking movies collection...');
    const moviesSnapshot = await db.collection('movies').limit(5).get();
    
    if (moviesSnapshot.empty) {
      console.log('❌ No movies found in database');
      console.log('💡 You need to import movies first using your existing import script');
      return;
    }
    
    console.log(`✅ Found ${moviesSnapshot.size} movies`);
    
    // Test 3: Check movie structure
    console.log('\n🔍 Checking movie structure...');
    const firstMovie = moviesSnapshot.docs[0].data();
    console.log('First movie:', {
      id: moviesSnapshot.docs[0].id,
      title: firstMovie.title,
      hasFeatureVector: !!firstMovie.featureVector,
      hasGenres: !!firstMovie.genres,
      hasGenreIds: !!firstMovie.genreIds
    });
    
    // Test 4: Check if movies have required fields for feature vectors
    const moviesWithGenres = moviesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.genres && data.genres.length > 0;
    });
    
    console.log(`\n📊 Movies with genres: ${moviesWithGenres.length}/${moviesSnapshot.size}`);
    
    if (moviesWithGenres.length === 0) {
      console.log('❌ No movies have genre information');
      console.log('💡 You need to import movies with genre data');
      return;
    }
    
    // Test 5: Check feature vectors
    const moviesWithFeatures = moviesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.featureVector;
    });
    
    console.log(`📊 Movies with feature vectors: ${moviesWithFeatures.length}/${moviesSnapshot.size}`);
    
    if (moviesWithFeatures.length === 0) {
      console.log('\n🔧 No movies have feature vectors yet');
      console.log('💡 You need to run: populateMovieFeatures() from Firebase Functions');
      console.log('   Or deploy the updated functions and call it from Flutter');
    } else {
      console.log('✅ Movies have feature vectors - ready for recommendations!');
    }
    
    // Test 6: Show sample movie data
    console.log('\n🎬 Sample movie data:');
    const sampleMovie = moviesSnapshot.docs[0].data();
    console.log({
      title: sampleMovie.title,
      genres: sampleMovie.genres || 'No genres',
      genreIds: sampleMovie.genreIds || 'No genre IDs',
      popularity: sampleMovie.popularity || 'No popularity',
      voteAverage: sampleMovie.voteAverage || 'No rating'
    });
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

// Run the test
testDatabase()
  .then(() => {
    console.log('\n✅ Database test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  });
