const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

console.log('TMDB API Key:', TMDB_API_KEY ? 'Set' : 'Not set');
console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);

async function testImport() {
  try {
    console.log('Testing TMDB API connection...');
    
    // Test TMDB API
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=1&language=en-US`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ TMDB API working! Found ${data.results.length} movies`);
    
    // Import first 5 movies
    const movies = data.results.slice(0, 5);
    const batch = db.batch();
    const timestamp = admin.firestore.Timestamp.now();

    for (const movie of movies) {
      const movieData = {
        tmdbId: movie.id,
        title: movie.title,
        overview: movie.overview,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        releaseDate: movie.release_date,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
        genreIds: movie.genre_ids,
        popularity: movie.popularity,
        // Category flags
        isPopular: true, // Since this is from popular endpoint
        isTrending: false,
        isTopRated: false,
        isNowPlaying: false,
        isUpcoming: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const movieRef = db.collection('movies').doc(movie.id.toString());
      batch.set(movieRef, movieData, { merge: true });
      
      console.log(`📽️  Adding: ${movie.title} (${movie.id})`);
    }

    await batch.commit();
    console.log(`✅ Successfully imported ${movies.length} movies to Firestore!`);
    
    // Verify by reading back
    const snapshot = await db.collection('movies').limit(5).get();
    console.log(`📊 Firestore now contains ${snapshot.size} movies`);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.title} (${data.tmdbId})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('  Cause:', error.cause.message);
    }
  }
}

testImport().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 