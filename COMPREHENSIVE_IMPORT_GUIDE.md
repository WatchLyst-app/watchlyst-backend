# 🎬 WatchLyst Comprehensive Movie Import Guide

## Overview

This guide explains how to import ALL movies from TMDB into your Firebase Firestore database using the `/discover/movie` endpoint and getting detailed information for each movie including genres.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the `watchlyst_backend` directory:

```bash
TMDB_API_KEY=your_tmdb_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
```

### 2. Run the Import

**Option A: Using the shell script (Recommended)**
```bash
./run-import.sh
```

**Option B: Using npm**
```bash
npm run import:comprehensive
```

## 📋 What the Import Does

### 1. **Discovers Movies**
- Uses `/discover/movie` endpoint to find ALL available movies
- Processes up to 500 pages (25,000+ movies)
- Sorts by popularity to get the most relevant movies first

### 2. **Gets Detailed Information**
- For each movie, calls `/movie/{movie_id}` to get complete details
- Includes genres, runtime, budget, revenue, production companies, etc.
- Skips movies that already exist in the database

### 3. **Stores in Firestore**
- Saves complete movie information with genres
- Includes all metadata like production companies, countries, languages
- Maintains timestamps for tracking

## 🎯 Features

### ✅ **Comprehensive Data**
- **Genres**: Full genre names (e.g., "Action", "Drama", "Comedy")
- **Runtime**: Movie duration in minutes
- **Budget & Revenue**: Financial information
- **Production Details**: Companies, countries, languages
- **IMDB ID**: For external references
- **Original Title**: For international movies

### ✅ **Smart Importing**
- **Duplicate Prevention**: Skips movies already in database
- **Error Handling**: Continues even if some movies fail
- **Rate Limiting**: Respects TMDB API limits
- **Batch Processing**: Processes movies in small batches

### ✅ **Performance Optimized**
- **Parallel Processing**: Multiple movies processed simultaneously
- **Caching**: Genres cached to avoid repeated API calls
- **Timeout Handling**: 15-second timeout for API calls
- **Progress Tracking**: Real-time progress updates

## 📊 Expected Results

### **Database Structure**
Each movie document will contain:
```json
{
  "tmdbId": 12345,
  "title": "Movie Title",
  "originalTitle": "Original Title",
  "overview": "Movie description...",
  "tagline": "Movie tagline",
  "posterPath": "/path/to/poster.jpg",
  "backdropPath": "/path/to/backdrop.jpg",
  "releaseDate": "2023-01-01",
  "voteAverage": 8.5,
  "voteCount": 1000,
  "popularity": 100.0,
  "runtime": 120,
  "status": "Released",
  "budget": 50000000,
  "revenue": 200000000,
  "genres": ["Action", "Drama", "Thriller"],
  "genreIds": [28, 18, 53],
  "homepage": "https://movie.com",
  "imdbId": "tt1234567",
  "originalLanguage": "en",
  "productionCompanies": [...],
  "productionCountries": [...],
  "spokenLanguages": [...],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### **Expected Statistics**
- **Total Movies**: 25,000+ (depending on TMDB availability)
- **Import Time**: 2-4 hours
- **API Calls**: ~25,000 calls to TMDB
- **Database Size**: ~50-100MB

## ⚠️ Important Notes

### **API Limits**
- TMDB allows 1000 requests per day for free accounts
- The import will make ~25,000 API calls
- Consider upgrading to a paid TMDB account for large imports

### **Time Requirements**
- **Full Import**: 2-4 hours
- **Partial Import**: Can be stopped and resumed
- **Network**: Requires stable internet connection

### **Storage Requirements**
- **Firestore**: ~50-100MB for 25,000 movies
- **Local Storage**: Minimal (scripts are small)

## 🔧 Troubleshooting

### **Common Issues**

1. **"TMDB API key not set"**
   - Check your `.env` file
   - Ensure `TMDB_API_KEY` is correctly set

2. **"Firebase credentials error"**
   - Verify Firebase service account credentials
   - Check `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

3. **"Import stops after few movies"**
   - Check TMDB API rate limits
   - Verify internet connection
   - Check Firebase permissions

4. **"Movies not showing in app"**
   - Wait for import to complete
   - Check Firebase console for data
   - Verify app is connecting to correct Firebase project

### **Monitoring Progress**

The script provides real-time feedback:
```
🚀 Starting COMPREHENSIVE movie import from TMDB...
📚 Fetching genres from TMDB...
✅ Loaded 19 genres
🎬 Starting discovery import...
📄 Processing page 1...
📋 Found 20 movies on page 1
  🔄 Processing batch 1/4
🔍 Getting details for: Movie Title (ID: 12345)
✅ Imported: Movie Title (Action, Drama)
✅ Page 1 completed - Imported: 20, Skipped: 0, Errors: 0
```

## 🎉 Success Indicators

When the import completes successfully, you should see:
```
🎉 COMPREHENSIVE import completed!
📊 Final Statistics:
   ✅ Total imported: 25000
   ⏭️  Total skipped (already exist): 0
   ❌ Total errors: 0
   📄 Total pages processed: 500
📋 Total unique movies in database: 25000
```

## 🔄 Resuming Interrupted Imports

If the import is interrupted, you can safely restart it:
- The script automatically skips existing movies
- No duplicate data will be created
- Progress will continue from where it left off

## 📱 Frontend Integration

After the import completes, your Flutter app will automatically:
- Display movies with genre information
- Show complete movie details
- Handle the new data structure seamlessly

The app is already configured to handle the new genre fields and will display them appropriately in the UI.

---

**Happy Importing! 🎬✨** 