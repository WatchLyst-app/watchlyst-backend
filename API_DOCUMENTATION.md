# WatchLyst Backend API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
All endpoints require proper authentication. User-specific endpoints require a valid `userId` in the request.

## Endpoints

### Movies

#### GET /api/movies
Get movies from Firestore database.

**Query Parameters:**
- `limit` (optional): Number of movies to return (default: 20)
- `page` (optional): Page number for pagination (default: 1)

**Response:**
```json
{
  "success": true,
  "movies": [
    {
      "id": "movie_id",
      "tmdbId": 12345,
      "title": "Movie Title",
      "overview": "Movie description...",
      "posterPath": "/path/to/poster.jpg",
      "backdropPath": "/path/to/backdrop.jpg",
      "releaseDate": "2023-01-01",
      "voteAverage": 8.5,
      "voteCount": 1000,
      "genreIds": [28, 12],
      "popularity": 100.5,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20
}
```

#### POST /api/movies/import
Import movies from TMDB API to Firestore.

**Query Parameters:**
- `page` (optional): TMDB page number (default: 1)
- `limit` (optional): Number of movies to import (default: 20)

**Response:**
```json
{
  "success": true,
  "message": "Imported 20 movies from TMDB",
  "page": 1,
  "totalResults": 1000
}
```

### User Interactions

#### POST /api/swipes
Record a user's swipe action (like/dislike) for a movie.

**Request Body:**
```json
{
  "userId": "user_id",
  "movieId": "movie_id",
  "action": "like" // or "dislike"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Swipe recorded successfully"
}
```

#### GET /api/watchlist
Get user's watchlist (liked movies).

**Query Parameters:**
- `userId` (required): User ID

**Response:**
```json
{
  "success": true,
  "watchlist": [
    {
      "id": "swipe_id",
      "userId": "user_id",
      "movieId": "movie_id",
      "action": "like",
      "timestamp": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/lists
Add a movie to user's custom list.

**Request Body:**
```json
{
  "userId": "user_id",
  "movieId": "movie_id",
  "listName": "My Favorites"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Movie added to list successfully"
}
```

#### GET /api/lists
Get user's custom lists.

**Query Parameters:**
- `userId` (required): User ID

**Response:**
```json
{
  "success": true,
  "lists": [
    {
      "id": "list_id",
      "userId": "user_id",
      "movieId": "movie_id",
      "listName": "My Favorites",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400`: Bad Request (missing required fields)
- `401`: Unauthorized (authentication required)
- `500`: Internal Server Error

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

## Rate Limiting

- TMDB API: Respects TMDB rate limits
- Firestore: Follows Firebase quotas
- Import operations: 1 second delay between pages

## Security

- All user-specific data is protected by Firestore security rules
- Users can only access their own data
- Movie data is publicly readable but admin-writable only
- Authentication required for all user operations 