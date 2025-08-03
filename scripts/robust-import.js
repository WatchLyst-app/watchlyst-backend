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
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function fetchWithRetry(endpoint, page = 1, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          timeout: 20000, // 20 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.log(`  ⚠️  Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function importMovies(category, endpoint, maxPages = 10) {
  console.log(`\n🎬 Importing ${category} movies...`);
  
  let totalImported = 0;
  let successfulPages = 0;
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`  📄 Fetching page ${page}...`);
      const data = await fetchWithRetry(endpoint, page);
      
      if (!data.results || data.results.length === 0) {
        console.log(`  ⚠️  No more movies on page ${page}`);
        break;
      }

      const movies = data.results;
      const batch = db.batch();
      const timestamp = admin.firestore.Timestamp.now();

      for (const movie of movies) {
        // Get existing movie data to preserve flags
        const movieRef = db.collection('movies').doc(movie.id.toString());
        const existingDoc = await movieRef.get();
        let existingData = {};
        
        if (existingDoc.exists) {
          existingData = existingDoc.data();
        }

        // Determine flags based on endpoint
        const isPopular = endpoint.includes('popular') || existingData.isPopular || false;
        const isTopRated = endpoint.includes('top_rated') || existingData.isTopRated || false;
        const isNowPlaying = endpoint.includes('now_playing') || existingData.isNowPlaying || false;
        const isUpcoming = endpoint.includes('upcoming') || existingData.isUpcoming || false;
        const isTrending = endpoint.includes('trending') || existingData.isTrending || false;

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
          isPopular: isPopular,
          isTopRated: isTopRated,
          isNowPlaying: isNowPlaying,
          isUpcoming: isUpcoming,
          isTrending: isTrending,
          // Update timestamps
          createdAt: existingData.createdAt || timestamp,
          updatedAt: timestamp,
        };

        batch.set(movieRef, movieData, { merge: true });
      }

      await batch.commit();
      totalImported += movies.length;
      successfulPages++;
      
      console.log(`  ✅ Imported ${movies.length} movies from page ${page}`);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`  ❌ Error on page ${page}:`, error.message);
      // Continue with next page instead of breaking
      continue;
    }
  }
  
  console.log(`🎯 Total ${category} movies imported: ${totalImported} (${successfulPages} pages)`);
  return totalImported;
}

async function robustImport() {
  try {
    console.log('🚀 Starting robust movie import from TMDB...');
    console.log('TMDB API Key:', TMDB_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
    
    let totalImported = 0;
    
    // Import from multiple endpoints with retry logic
    const endpoints = [
      { name: 'Popular Movies', endpoint: '/movie/popular', maxPages: 20 },
      { name: 'Top Rated Movies', endpoint: '/movie/top_rated', maxPages: 20 },
      { name: 'Now Playing Movies', endpoint: '/movie/now_playing', maxPages: 10 },
      { name: 'Upcoming Movies', endpoint: '/movie/upcoming', maxPages: 10 },
      { name: 'Trending Movies (Week)', endpoint: '/trending/movie/week', maxPages: 5 },
    ];
    
    for (const { name, endpoint, maxPages } of endpoints) {
      const imported = await importMovies(name, endpoint, maxPages);
      totalImported += imported;
    }
    
    console.log(`\n🎉 Robust import completed!`);
    console.log(`📊 Total movies imported: ${totalImported}`);
    
    // Get final count
    const snapshot = await db.collection('movies').get();
    console.log(`📋 Total unique movies in database: ${snapshot.size}`);
    
    // Show sample with flags
    const sampleSnapshot = await db.collection('movies').limit(5).get();
    console.log(`\n📋 Sample of imported movies with flags:`);
    
    sampleSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const flags = [];
      if (data.isTrending) flags.push('🔥 Trending');
      if (data.isPopular) flags.push('⭐ Popular');
      if (data.isTopRated) flags.push('🏆 Top Rated');
      if (data.isNowPlaying) flags.push('🎬 Now Playing');
      if (data.isUpcoming) flags.push('📅 Upcoming');
      
      console.log(`  ${index + 1}. ${data.title} - Rating: ${data.voteAverage}/10`);
      console.log(`     Flags: ${flags.length > 0 ? flags.join(', ') : 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    if (error.cause) {
      console.error('  Cause:', error.cause.message);
    }
  }
}

robustImport().then(() => {
  console.log('\n✨ Robust import process completed!');
  process.exit(0);
}).catch(error => {
  console.error('Robust import process failed:', error);
  process.exit(1);
}); 