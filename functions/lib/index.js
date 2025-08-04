"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserLists = exports.addToList = exports.getWatchlist = exports.updateFaceOff = exports.getMovies = exports.importMoviesFromTMDB = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// TMDB API configuration
const TMDB_API_KEY = ((_a = functions.config().tmdb) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// Function to import movies from TMDB API
exports.importMoviesFromTMDB = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    try {
        if (!TMDB_API_KEY) {
            res.status(500).json({ error: 'TMDB API key not configured' });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        // Fetch popular movies from TMDB with detailed information
        const response = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}&language=en-US&append_to_response=credits,videos,images`);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }
        const data = await response.json();
        const movies = data.results;
        // Process and store movies in Firestore
        const batch = db.batch();
        const timestamp = admin.firestore.Timestamp.now();
        for (const movie of movies.slice(0, limit)) {
            // Get genre names from IDs
            const genreNames = ((_a = movie.genres) === null || _a === void 0 ? void 0 : _a.map(genre => genre.name)) || [];
            const movieData = {
                tmdbId: movie.id,
                title: movie.title,
                originalTitle: movie.original_title,
                overview: movie.overview,
                tagline: movie.tagline,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                releaseDate: movie.release_date,
                voteAverage: movie.vote_average,
                voteCount: movie.vote_count,
                popularity: movie.popularity,
                runtime: movie.runtime,
                status: movie.status,
                budget: movie.budget,
                revenue: movie.revenue,
                // Genres
                genreIds: movie.genre_ids,
                genres: genreNames,
                // Additional details
                homepage: movie.homepage,
                imdbId: movie.imdb_id,
                originalLanguage: movie.original_language,
                productionCompanies: (_b = movie.production_companies) === null || _b === void 0 ? void 0 : _b.map(company => ({
                    id: company.id,
                    name: company.name,
                    logoPath: company.logo_path,
                    originCountry: company.origin_country
                })),
                productionCountries: (_c = movie.production_countries) === null || _c === void 0 ? void 0 : _c.map(country => ({
                    iso31661: country.iso_3166_1,
                    name: country.name
                })),
                spokenLanguages: (_d = movie.spoken_languages) === null || _d === void 0 ? void 0 : _d.map(lang => ({
                    iso6391: lang.iso_639_1,
                    name: lang.name
                })),
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            const movieRef = db.collection('movies').doc(movie.id.toString());
            batch.set(movieRef, movieData, { merge: true });
        }
        await batch.commit();
        res.json({
            success: true,
            message: `Imported ${movies.length} movies from TMDB`,
            page,
            totalResults: data.total_results,
        });
    }
    catch (error) {
        console.error('Error importing movies:', error);
        res.status(500).json({ error: 'Failed to import movies' });
    }
});
// Function to get movies from Firestore
exports.getMovies = functions.https.onRequest(async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;
        const moviesRef = db.collection('movies');
        const snapshot = await moviesRef
            .orderBy('popularity', 'desc')
            .limit(limit)
            .offset(offset)
            .get();
        const movies = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.json({
            success: true,
            movies,
            page,
            limit,
        });
    }
    catch (error) {
        console.error('Error fetching movies:', error);
        res.status(500).json({ error: 'Failed to fetch movies' });
    }
});
// Function to handle face-off updates
exports.updateFaceOff = functions.https.onRequest(async (req, res) => {
    var _a;
    try {
        const { userId, movieId, action } = req.body;
        if (!userId || !movieId || !action) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const swipeData = {
            userId,
            movieId,
            action,
            timestamp: admin.firestore.Timestamp.now(),
        };
        await db.collection('swipes').add(swipeData);
        // Update user's score based on action
        const userScoreRef = db.collection('scores').doc(userId);
        const scoreDoc = await userScoreRef.get();
        let currentScore = 0;
        if (scoreDoc.exists) {
            currentScore = ((_a = scoreDoc.data()) === null || _a === void 0 ? void 0 : _a.score) || 0;
        }
        const scoreIncrement = action === 'like' ? 1 : -1;
        await userScoreRef.set({
            userId,
            score: currentScore + scoreIncrement,
            updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
        res.json({
            success: true,
            message: 'Face-off updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating face-off:', error);
        res.status(500).json({ error: 'Failed to update face-off' });
    }
});
// Function to get user's watchlist
exports.getWatchlist = functions.https.onRequest(async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            res.status(400).json({ error: 'User ID required' });
            return;
        }
        const swipesRef = db.collection('swipes');
        const snapshot = await swipesRef
            .where('userId', '==', userId)
            .where('action', '==', 'like')
            .orderBy('timestamp', 'desc')
            .get();
        const likedMovies = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.json({
            success: true,
            watchlist: likedMovies,
        });
    }
    catch (error) {
        console.error('Error fetching watchlist:', error);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});
// Function to add movie to user's list
exports.addToList = functions.https.onRequest(async (req, res) => {
    try {
        const { userId, movieId, listName } = req.body;
        if (!userId || !movieId || !listName) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const listData = {
            userId,
            movieId,
            listName,
            createdAt: admin.firestore.Timestamp.now(),
        };
        await db.collection('lists').add(listData);
        res.json({
            success: true,
            message: 'Movie added to list successfully',
        });
    }
    catch (error) {
        console.error('Error adding to list:', error);
        res.status(500).json({ error: 'Failed to add to list' });
    }
});
// Function to get user's lists
exports.getUserLists = functions.https.onRequest(async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            res.status(400).json({ error: 'User ID required' });
            return;
        }
        const listsRef = db.collection('lists');
        const snapshot = await listsRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const lists = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.json({
            success: true,
            lists,
        });
    }
    catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ error: 'Failed to fetch lists' });
    }
});
//# sourceMappingURL=index.js.map