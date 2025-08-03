# WatchLyst Backend

A Firebase-powered backend for the WatchLyst movie app, featuring TMDB integration, user authentication, and real-time data management.

## Architecture

- **Firebase Firestore**: Stores swipes, lists, scores, and movie data
- **Firebase Auth**: Secure user authentication and account management
- **Firebase Functions**: Serverless logic for face-off updates and data processing
- **Firebase Analytics**: Track user engagement and app performance
- **Firebase Cloud Messaging**: Push notifications for user engagement

## Features

- Import movies from TMDB API and store in Firestore
- Handle user swipes (like/dislike) with score tracking
- Manage user watchlists and custom lists
- Real-time data synchronization
- Secure API endpoints with authentication

## Setup

### Prerequisites

- Node.js (v18 or higher)
- Firebase CLI
- TMDB API key
- Firebase project

### Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd watchlyst_backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Configure your `.env` file with your Firebase and TMDB credentials:
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
TMDB_API_KEY=your_tmdb_api_key
```

5. Install Firebase Functions dependencies:
```bash
cd functions
npm install
cd ..
```

### Firebase Setup

1. Initialize Firebase project:
```bash
firebase login
firebase init
```

2. Select the following services:
   - Firestore
   - Functions
   - Hosting (optional)

3. Deploy Firebase configuration:
```bash
firebase deploy
```

## API Endpoints

### Movies

- `GET /api/movies` - Get movies from Firestore
- `POST /api/movies/import` - Import movies from TMDB

### User Interactions

- `POST /api/swipes` - Record user swipe (like/dislike)
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/lists` - Add movie to user's list
- `GET /api/lists` - Get user's lists

## Development

### Start Development Server

```bash
npm run dev
```

### Deploy Functions

```bash
npm run deploy:functions
```

### Run Emulators

```bash
npm run emulators
```

## Database Schema

### Collections

#### movies
- `tmdbId` (number): TMDB movie ID
- `title` (string): Movie title
- `overview` (string): Movie description
- `posterPath` (string): Poster image path
- `backdropPath` (string): Backdrop image path
- `releaseDate` (string): Release date
- `voteAverage` (number): Average rating
- `voteCount` (number): Number of votes
- `genreIds` (array): Genre IDs
- `popularity` (number): Popularity score
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp

#### swipes
- `userId` (string): User ID
- `movieId` (string): Movie ID
- `action` (string): 'like' or 'dislike'
- `timestamp` (timestamp): Swipe timestamp

#### lists
- `userId` (string): User ID
- `movieId` (string): Movie ID
- `listName` (string): List name
- `createdAt` (timestamp): Creation timestamp

#### scores
- `userId` (string): User ID
- `score` (number): User score
- `updatedAt` (timestamp): Last update timestamp

## Security Rules

Firestore security rules ensure:
- Users can only access their own data
- Movie data is publicly readable but only admin-writable
- Proper authentication for all user-specific operations

## TMDB Integration

The backend automatically imports popular movies from TMDB API and stores them in Firestore for fast access. The import process:

1. Fetches popular movies from TMDB
2. Transforms data to match our schema
3. Stores in Firestore with proper indexing
4. Updates existing movies to keep data fresh

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License. 