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

async function fetchWithRetry(url, options = {}, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} for: ${url.substring(0, 60)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WatchLyst-Massive-Import/1.0',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Success on attempt ${attempt}`);
      return data;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function getGenres() {
  if (genresCache.size > 0) {
    return genresCache;
  }
  
  try {
    console.log('📚 Fetching genres from TMDB...');
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`
    );
    
    response.genres.forEach(genre => {
      genresCache.set(genre.id, genre.name);
    });
    
    console.log(`✅ Loaded ${genresCache.size} genres`);
    return genresCache;
  } catch (error) {
    console.error('❌ Failed to fetch genres:', error.message);
    console.log('🔄 Using fallback genres...');
    
    // Fallback genres
    const fallbackGenres = new Map([
      [28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'],
      [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'],
      [14, 'Fantasy'], [36, 'History'], [27, 'Horror'], [10402, 'Music'],
      [9648, 'Mystery'], [10749, 'Romance'], [878, 'Science Fiction'],
      [10770, 'TV Movie'], [53, 'Thriller'], [10752, 'War'], [37, 'Western']
    ]);
    
    fallbackGenres.forEach((name, id) => genresCache.set(id, name));
    console.log(`✅ Using ${genresCache.size} fallback genres`);
    return genresCache;
  }
}

async function getMovieDetails(movieId) {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,images`
    );
    
    return response;
  } catch (error) {
    console.error(`❌ Failed to get details for movie ${movieId}:`, error.message);
    return null;
  }
}

async function fetchMoviesFromEndpoint(endpoint, page = 1, sortBy = 'popularity.desc') {
  try {
    const response = await fetchWithRetry(
      `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&sort_by=${sortBy}&include_adult=false&include_video=false&page=${page}&with_watch_monetization_types=flatrate`
    );
    
    return response;
  } catch (error) {
    console.error(`❌ Failed to fetch movies from ${endpoint} on page ${page}:`, error.message);
    return null;
  }
}

async function checkExistingMovie(tmdbId) {
  try {
    const doc = await db.collection('movies').doc(tmdbId.toString()).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error(`❌ Error checking existing movie ${tmdbId}:`, error.message);
    return null;
  }
}

async function importMovieWithDetails(movie, genres) {
  try {
    const tmdbId = movie.id;
    
    // Check if movie already exists
    const existingData = await checkExistingMovie(tmdbId);
    if (existingData) {
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

async function importFromEndpoint(endpoint, name, maxPages = 50) {
  console.log(`\n🎬 Importing from ${name} (${endpoint})...`);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let page = 1;
  
  while (page <= maxPages) {
    try {
      console.log(`  📄 Processing page ${page}...`);
      
      const data = await fetchMoviesFromEndpoint(endpoint, page);
      
      if (!data || !data.results || data.results.length === 0) {
        console.log(`  ⚠️  No more movies found on page ${page}`);
        break;
      }
      
      console.log(`  📋 Found ${data.results.length} movies on page ${page}`);
      
      // Process movies in batches
      const batchSize = 5;
      for (let i = 0; i < data.results.length; i += batchSize) {
        const batch = data.results.slice(i, i + batchSize);
        
        console.log(`    🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.results.length/batchSize)}`);
        
        const results = await Promise.allSettled(
          batch.map(movie => importMovieWithDetails(movie, genresCache))
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
            console.error('    ❌ Promise rejected:', result.reason);
          }
        });
        
        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      console.log(`  ✅ Page ${page} completed - Imported: ${totalImported}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
      
      page++;
      
      // Add delay between pages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`  ❌ Error processing page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`🎯 ${name} completed - Total: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`);
  return { imported: totalImported, skipped: totalSkipped, errors: totalErrors };
}

async function massiveImport() {
  try {
    console.log('🚀 Starting MASSIVE movie import from TMDB...');
    console.log('TMDB API Key:', TMDB_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
    
    // Get genres first
    await getGenres();
    
    // Define multiple endpoints to import from
    const endpoints = [
      { name: 'Popular Movies', endpoint: '/movie/popular', maxPages: 100 },
      { name: 'Top Rated Movies', endpoint: '/movie/top_rated', maxPages: 100 },
      { name: 'Now Playing Movies', endpoint: '/movie/now_playing', maxPages: 50 },
      { name: 'Upcoming Movies', endpoint: '/movie/upcoming', maxPages: 50 },
      { name: 'Latest Movies', endpoint: '/movie/latest', maxPages: 1 },
      { name: 'Trending Movies (Week)', endpoint: '/trending/movie/week', maxPages: 50 },
      { name: 'Trending Movies (Day)', endpoint: '/trending/movie/day', maxPages: 30 },
      { name: 'Discover Movies (Popularity)', endpoint: '/discover/movie', maxPages: 100 },
      { name: 'Discover Movies (Rating)', endpoint: '/discover/movie', maxPages: 100, sortBy: 'vote_average.desc' },
      { name: 'Discover Movies (Release Date)', endpoint: '/discover/movie', maxPages: 100, sortBy: 'release_date.desc' },
    ];
    
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const { name, endpoint, maxPages, sortBy } of endpoints) {
      const result = await importFromEndpoint(endpoint, name, maxPages, sortBy);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
      
      // Add delay between endpoints
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\n🎉 MASSIVE import completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   ✅ Total imported: ${totalImported}`);
    console.log(`   ⏭️  Total skipped (already exist): ${totalSkipped}`);
    console.log(`   ❌ Total errors: ${totalErrors}`);
    
    // Get final database count
    const snapshot = await db.collection('movies').get();
    console.log(`📋 Total unique movies in database: ${snapshot.size}`);
    
    // Show sample of imported movies
    const sampleSnapshot = await db.collection('movies').orderBy('createdAt', 'desc').limit(10).get();
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
    console.error('❌ Massive import failed:', error.message);
    if (error.cause) {
      console.error('  Cause:', error.cause.message);
    }
  }
}

massiveImport().then(() => {
  console.log('\n✨ Massive import process completed!');
  process.exit(0);
}).catch(error => {
  console.error('Massive import process failed:', error);
  process.exit(1);
}); 