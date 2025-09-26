const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin with production credentials
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || 'watchlyst-app',
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || 'watchlyst-app'
});

const db = admin.firestore();
const app = express();

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Get movies endpoint
app.get('/api/movies', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log(`Fetching movies: limit=${limit}, page=${page}, offset=${offset}`);
    
    // Get movies from Firestore
    const moviesSnapshot = await db.collection('movies')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .offset(offset)
      .get();
    
    const movies = [];
    moviesSnapshot.forEach(doc => {
      const data = doc.data();
      movies.push({
        id: doc.id,
        tmdbId: data.tmdbId,
        title: data.title,
        originalTitle: data.originalTitle,
        overview: data.overview,
        tagline: data.tagline,
        posterPath: data.posterPath,
        backdropPath: data.backdropPath,
        releaseDate: data.releaseDate,
        voteAverage: data.voteAverage,
        voteCount: data.voteCount,
        popularity: data.popularity,
        runtime: data.runtime,
        status: data.status,
        budget: data.budget,
        revenue: data.revenue,
        genreIds: data.genreIds,
        genres: data.genres,
        homepage: data.homepage,
        imdbId: data.imdbId,
        originalLanguage: data.originalLanguage,
        productionCompanies: data.productionCompanies,
        productionCountries: data.productionCountries,
        spokenLanguages: data.spokenLanguages,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`Found ${movies.length} movies`);
    
    res.json({
      success: true,
      movies: movies,
      total: movies.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get detailed movie information from TMDB
app.get('/api/movies/:movieId/details', async (req, res) => {
  try {
    const { movieId } = req.params;
    
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID is required' });
    }

    if (!TMDB_API_KEY) {
      return res.status(500).json({ error: 'TMDB API key not configured' });
    }

    console.log(`Fetching details for movie ID: ${movieId}`);

    // Fetch detailed movie information from TMDB
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,watch/providers`
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const movieData = await response.json();
    console.log(`Successfully fetched details for: ${movieData.title}`);

    // Extract relevant information
    const movieDetails = {
      id: movieData.id,
      title: movieData.title,
      overview: movieData.overview,
      releaseDate: movieData.release_date,
      runtime: movieData.runtime,
      
      // Cast information (first 10)
      cast: movieData.credits?.cast?.slice(0, 10).map(member => ({
        id: member.id,
        name: member.name,
        character: member.character,
        profilePath: member.profile_path,
        order: member.order,
      })) || [],
      
      // Crew information (director, producer)
      crew: {
        director: movieData.credits?.crew?.find(member => member.job === 'Director')?.name || 'Unknown',
        producer: movieData.credits?.crew?.find(member => member.job === 'Producer')?.name || 'Unknown',
      },
      
      // Videos/Trailers
      videos: movieData.videos?.results?.filter(video => 
        video.type === 'Trailer' && video.site === 'YouTube'
      ).map(video => ({
        id: video.id,
        key: video.key,
        name: video.name,
        site: video.site,
        type: video.type,
        official: video.official,
        youtubeUrl: `https://www.youtube.com/watch?v=${video.key}`,
        thumbnailUrl: `https://img.youtube.com/vi/${video.key}/maxresdefault.jpg`,
      })) || [],
      
      // Watch providers
      watchProviders: extractWatchProviders(movieData['watch/providers']?.results || {}),
    };

    res.json({
      success: true,
      movieDetails,
    });
  } catch (error) {
    console.error('Error fetching movie details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch movie details',
      message: error.message 
    });
  }
});

// Helper function to extract watch providers
function extractWatchProviders(results) {
  const providers = [];
  const countryCodes = ['US', 'GB', 'CA', 'AU', 'IN'];
  
  for (const countryCode of countryCodes) {
    if (results[countryCode]) {
      const countryData = results[countryCode];
      
      // Streaming providers
      if (countryData.flatrate) {
        countryData.flatrate.forEach(provider => {
          providers.push({
            id: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path,
            type: 'Streaming',
            country: countryCode,
          });
        });
      }
      
      // Rental providers
      if (countryData.rent) {
        countryData.rent.forEach(provider => {
          providers.push({
            id: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path,
            type: 'Rent',
            country: countryCode,
          });
        });
      }
      
      // Purchase providers
      if (countryData.buy) {
        countryData.buy.forEach(provider => {
          providers.push({
            id: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path,
            type: 'Buy',
            country: countryCode,
          });
        });
      }
      
      break; // Use first available country
    }
  }
  
  return providers;
}

// Record swipe endpoint
app.post('/api/swipes', async (req, res) => {
  try {
    const { userId, movieId, action } = req.body;
    
    console.log(`Recording swipe: userId=${userId}, movieId=${movieId}, action=${action}`);
    
    // Store swipe in Firestore
    await db.collection('swipes').add({
      userId: userId,
      movieId: movieId,
      action: action,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Swipe recorded successfully'
    });
  } catch (error) {
    console.error('Error recording swipe:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Bind to all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`Simple server running on ${HOST}:${PORT}`);
  console.log(`Movies endpoint: http://192.168.1.2:${PORT}/api/movies`);
  console.log(`Swipes endpoint: http://192.168.1.2:${PORT}/api/swipes`);
}); 