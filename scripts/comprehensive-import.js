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

async function fetchMovies(endpoint, page = 1) {
  const response = await fetch(
    `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      timeout: 15000,
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

async function importMovies(category, endpoint, pages = 3) {
  console.log(`\n🎬 Importing ${category} movies...`);
  
  let totalImported = 0;
  
  for (let page = 1; page <= pages; page++) {
    try {
      console.log(`  📄 Fetching page ${page}...`);
      const data = await fetchMovies(endpoint, page);
      
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
          isTrending: category === 'Trending' ? true : (existingData.isTrending || false),
          isPopular: category === 'Popular' ? true : (existingData.isPopular || false),
          isTopRated: category === 'Top Rated' ? true : (existingData.isTopRated || false),
          isNowPlaying: category === 'Now Playing' ? true : (existingData.isNowPlaying || false),
          // Update timestamps
          createdAt: existingData.createdAt || timestamp,
          updatedAt: timestamp,
        };

        batch.set(movieRef, movieData, { merge: true });
      }

      await batch.commit();
      totalImported += movies.length;
      console.log(`  ✅ Imported ${movies.length} movies from page ${page}`);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`  ❌ Error on page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`🎯 Total ${category} movies imported: ${totalImported}`);
  return totalImported;
}

async function comprehensiveImport() {
  try {
    console.log('🚀 Starting comprehensive movie import...');
    console.log('TMDB API Key:', TMDB_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
    
    let totalMovies = 0;
    
    // Import different categories
    const categories = [
      {
        name: 'Popular',
        endpoint: '/movie/popular',
        pages: 5
      },
      {
        name: 'Trending',
        endpoint: '/trending/movie/week',
        pages: 3
      },
      {
        name: 'Top Rated',
        endpoint: '/movie/top_rated',
        pages: 5
      },
      {
        name: 'Now Playing',
        endpoint: '/movie/now_playing',
        pages: 3
      }
    ];
    
    for (const category of categories) {
      const imported = await importMovies(category.name, category.endpoint, category.pages);
      totalMovies += imported;
    }
    
    console.log(`\n🎉 Comprehensive import completed!`);
    console.log(`📊 Total movies imported: ${totalMovies}`);
    
    // Verify by reading back and showing flags
    const snapshot = await db.collection('movies').limit(10).get();
    console.log(`\n📋 Sample of imported movies with flags:`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const flags = [];
      if (data.isTrending) flags.push('🔥 Trending');
      if (data.isPopular) flags.push('⭐ Popular');
      if (data.isTopRated) flags.push('🏆 Top Rated');
      if (data.isNowPlaying) flags.push('🎬 Now Playing');
      
      console.log(`  ${index + 1}. ${data.title} - Rating: ${data.voteAverage}/10`);
      console.log(`     Flags: ${flags.join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    if (error.cause) {
      console.error('  Cause:', error.cause.message);
    }
  }
}

comprehensiveImport().then(() => {
  console.log('\n✨ Import process completed!');
  process.exit(0);
}).catch(error => {
  console.error('Import process failed:', error);
  process.exit(1);
}); 