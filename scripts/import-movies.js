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

async function importMovies(page = 1, limit = 20) {
  try {
    if (!TMDB_API_KEY) {
      console.error('TMDB API key not configured');
      return;
    }

    console.log(`Importing movies from page ${page}...`);

    // Fetch popular movies from TMDB
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    const movies = data.results;

    console.log(`Found ${movies.length} movies on page ${page}`);

    // Process and store movies in Firestore
    const batch = db.batch();
    const timestamp = admin.firestore.Timestamp.now();

    for (const movie of movies.slice(0, limit)) {
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
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const movieRef = db.collection('movies').doc(movie.id.toString());
      batch.set(movieRef, movieData, { merge: true });
    }

    await batch.commit();

    console.log(`Successfully imported ${movies.length} movies from page ${page}`);
    console.log(`Total results available: ${data.total_results}`);

    return {
      imported: movies.length,
      totalResults: data.total_results,
      hasMore: page * 20 < data.total_results,
    };
  } catch (error) {
    console.error('Error importing movies:', error);
    throw error;
  }
}

async function importMultiplePages(startPage = 1, endPage = 5) {
  console.log(`Starting import from page ${startPage} to ${endPage}...`);
  
  let totalImported = 0;
  
  for (let page = startPage; page <= endPage; page++) {
    try {
      const result = await importMovies(page, 20);
      totalImported += result.imported;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!result.hasMore) {
        console.log('No more pages available');
        break;
      }
    } catch (error) {
      console.error(`Error importing page ${page}:`, error);
      break;
    }
  }
  
  console.log(`Import completed! Total movies imported: ${totalImported}`);
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'single':
    const page = parseInt(args[1]) || 1;
    const limit = parseInt(args[2]) || 20;
    importMovies(page, limit)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;
    
  case 'multiple':
    const startPage = parseInt(args[1]) || 1;
    const endPage = parseInt(args[2]) || 5;
    importMultiplePages(startPage, endPage)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;
    
  default:
    console.log('Usage:');
    console.log('  node scripts/import-movies.js single [page] [limit]');
    console.log('  node scripts/import-movies.js multiple [startPage] [endPage]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/import-movies.js single 1 20');
    console.log('  node scripts/import-movies.js multiple 1 5');
    process.exit(0);
} 