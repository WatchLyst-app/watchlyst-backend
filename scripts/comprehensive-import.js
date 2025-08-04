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

// Cache for genres to avoid repeated API calls
const genresCache = new Map();

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function getGenres() {
  if (genresCache.size > 0) {
    return genresCache;
  }
  
  try {
    console.log('📚 Fetching genres from TMDB...');
    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`
    );
    
    response.genres.forEach(genre => {
      genresCache.set(genre.id, genre.name);
    });
    
    console.log(`✅ Loaded ${genresCache.size} genres`);
    return genresCache;
  } catch (error) {
    console.error('❌ Failed to fetch genres:', error.message);
    return new Map();
  }
}

async function getMovieDetails(movieId) {
  try {
    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,images`
    );
    
    return response;
  } catch (error) {
    console.error(`❌ Failed to get details for movie ${movieId}:`, error.message);
    return null;
  }
}

async function discoverMovies(page = 1, sortBy = 'popularity.desc') {
  try {
    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=${sortBy}&include_adult=false&include_video=false&page=${page}&with_watch_monetization_types=flatrate`
    );
    
    return response;
  } catch (error) {
    console.error(`❌ Failed to discover movies on page ${page}:`, error.message);
    return null;
  }
}

async function checkExistingMovie(tmdbId) {
  try {
    const doc = await db.collection('movies').doc(tmdbId.toString()).get();
    return doc.exists;
  } catch (error) {
    console.error(`❌ Error checking existing movie ${tmdbId}:`, error.message);
    return false;
  }
}

async function importMovieWithDetails(movie, genres) {
  try {
    const tmdbId = movie.id;
    
    // Check if movie already exists
    const exists = await checkExistingMovie(tmdbId);
    if (exists) {
      console.log(`⏭️  Movie already exists: ${movie.title} (ID: ${tmdbId})`);
      return { skipped: true, tmdbId };
    }
    
    // Get detailed movie information
    console.log(`🔍 Getting details for: ${movie.title} (ID: ${tmdbId})`);
    const details = await getMovieDetails(tmdbId);
    
    if (!details) {
      console.log(`⚠️  Skipping ${movie.title} - failed to get details`);
      return { skipped: true, tmdbId };
    }
    
    // Get genre names from IDs
    const genreNames = details.genres?.map(genre => genre.name) || [];
    const genreIds = details.genres?.map(genre => genre.id) || [];
    
    const movieData = {
      tmdbId: tmdbId,
      title: details.title || movie.title,
      originalTitle: details.original_title,
      overview: details.overview || movie.overview,
      tagline: details.tagline,
      posterPath: details.poster_path || movie.poster_path,
      backdropPath: details.backdrop_path || movie.backdrop_path,
      releaseDate: details.release_date || movie.release_date,
      voteAverage: details.vote_average || movie.vote_average,
      voteCount: details.vote_count || movie.vote_count,
      popularity: details.popularity || movie.popularity,
      runtime: details.runtime,
      status: details.status,
      budget: details.budget,
      revenue: details.revenue,
      // Genres
      genreIds: genreIds,
      genres: genreNames,
      // Additional details
      homepage: details.homepage,
      imdbId: details.imdb_id,
      originalLanguage: details.original_language,
      productionCompanies: details.production_companies?.map(company => ({
        id: company.id,
        name: company.name,
        logoPath: company.logo_path,
        originCountry: company.origin_country
      })) || [],
      productionCountries: details.production_countries?.map(country => ({
        iso31661: country.iso_3166_1,
        name: country.name
      })) || [],
      spokenLanguages: details.spoken_languages?.map(lang => ({
        iso6391: lang.iso_639_1,
        name: lang.name
      })) || [],
      // Timestamps
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    // Save to Firestore
    await db.collection('movies').doc(tmdbId.toString()).set(movieData);
    
    console.log(`✅ Imported: ${movieData.title} (${genreNames.join(', ')})`);
    return { success: true, tmdbId, title: movieData.title };
    
  } catch (error) {
    console.error(`❌ Error importing movie ${movie.id}:`, error.message);
    return { error: true, tmdbId: movie.id };
  }
}

async function comprehensiveImport() {
  try {
    console.log('🚀 Starting COMPREHENSIVE movie import from TMDB...');
    console.log('TMDB API Key:', TMDB_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
    
    // Get genres first
    const genres = await getGenres();
    
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let page = 1;
    const maxPages = 500; // TMDB has thousands of pages available
    
    console.log('\n🎬 Starting discovery import...');
    
    while (page <= maxPages) {
      try {
        console.log(`\n📄 Processing page ${page}...`);
        
        const discoverData = await discoverMovies(page);
        
        if (!discoverData || !discoverData.results || discoverData.results.length === 0) {
          console.log(`⚠️  No more movies found on page ${page}`);
          break;
        }
        
        console.log(`📋 Found ${discoverData.results.length} movies on page ${page}`);
        
        // Process movies in batches to avoid overwhelming the API
        const batchSize = 5;
        for (let i = 0; i < discoverData.results.length; i += batchSize) {
          const batch = discoverData.results.slice(i, i + batchSize);
          
          console.log(`  🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(discoverData.results.length/batchSize)}`);
          
          const results = await Promise.allSettled(
            batch.map(movie => importMovieWithDetails(movie, genres))
          );
          
          results.forEach(result => {
            if (result.status === 'fulfilled') {
              if (result.value.success) {
                totalImported++;
              } else if (result.value.skipped) {
                totalSkipped++;
              } else if (result.value.error) {
                totalErrors++;
              }
            } else {
              totalErrors++;
              console.error('❌ Promise rejected:', result.reason);
            }
          });
          
          // Add delay between batches to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`✅ Page ${page} completed - Imported: ${totalImported}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
        
        page++;
        
        // Add delay between pages
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing page ${page}:`, error.message);
        break;
      }
    }
    
    console.log('\n🎉 COMPREHENSIVE import completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   ✅ Total imported: ${totalImported}`);
    console.log(`   ⏭️  Total skipped (already exist): ${totalSkipped}`);
    console.log(`   ❌ Total errors: ${totalErrors}`);
    console.log(`   📄 Total pages processed: ${page - 1}`);
    
    // Get final database count
    const snapshot = await db.collection('movies').get();
    console.log(`📋 Total unique movies in database: ${snapshot.size}`);
    
    // Show sample of imported movies with genres
    const sampleSnapshot = await db.collection('movies').orderBy('createdAt', 'desc').limit(5).get();
    console.log(`\n📋 Sample of recently imported movies:`);
    
    sampleSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`  ${index + 1}. ${data.title}`);
      console.log(`     Genres: ${data.genres?.join(', ') || 'N/A'}`);
      console.log(`     Rating: ${data.voteAverage}/10 (${data.voteCount} votes)`);
      console.log(`     Runtime: ${data.runtime || 'N/A'} minutes`);
      console.log(`     Release: ${data.releaseDate || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Comprehensive import failed:', error.message);
    if (error.cause) {
      console.error('  Cause:', error.cause.message);
    }
  }
}

comprehensiveImport().then(() => {
  console.log('\n✨ Comprehensive import process completed!');
  process.exit(0);
}).catch(error => {
  console.error('Comprehensive import process failed:', error);
  process.exit(1);
}); 