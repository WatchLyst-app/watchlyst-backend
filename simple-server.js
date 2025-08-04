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