# WatchLyst Backend - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites
- Node.js (v18+)
- Firebase CLI: `npm install -g firebase-tools`
- TMDB API key: Get from [TMDB Settings](https://www.themoviedb.org/settings/api)
- Firebase project: Create at [Firebase Console](https://console.firebase.google.com/)

### 2. Setup Backend
```bash
cd watchlyst_backend

# Run setup script
npm run setup

# Install dependencies
npm install

# Install Firebase Functions dependencies
cd functions && npm install && cd ..
```

### 3. Configure Environment
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your credentials
nano .env
```

Required environment variables:
```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
TMDB_API_KEY=your_tmdb_api_key
```

### 4. Initialize Firebase
```bash
# Login to Firebase
firebase login

# Initialize Firebase project
firebase init

# Select services: Firestore, Functions
# Choose your project
# Use TypeScript for Functions: Yes
# Use ESLint: Yes
# Install dependencies: Yes
```

### 5. Deploy to Firebase
```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Functions
firebase deploy --only functions
```

### 6. Import Movies
```bash
# Import first 5 pages of popular movies
npm run import:movies:multiple 1 5
```

### 7. Start Development Server
```bash
# Start local development server
npm run dev
```

## 🎯 Test the API

### Get Movies
```bash
curl http://localhost:3000/api/movies
```

### Import Movies from TMDB
```bash
curl -X POST http://localhost:3000/api/movies/import?page=1&limit=20
```

### Record a Swipe
```bash
curl -X POST http://localhost:3000/api/swipes \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "movieId": "movie456",
    "action": "like"
  }'
```

## 📁 Project Structure

```
watchlyst_backend/
├── functions/           # Firebase Functions
│   ├── src/
│   │   └── index.ts    # Cloud Functions
│   └── package.json
├── scripts/
│   ├── setup.js        # Setup script
│   └── import-movies.js # Movie import script
├── firebase.json       # Firebase config
├── firestore.rules     # Security rules
├── firestore.indexes.json # Database indexes
├── index.js           # Express server
├── package.json       # Dependencies
└── README.md         # Full documentation
```

## 🔧 Common Commands

```bash
# Development
npm run dev              # Start development server
npm run emulators       # Start Firebase emulators

# Deployment
npm run deploy          # Deploy everything
npm run deploy:functions # Deploy only functions
npm run deploy:firestore # Deploy only Firestore

# Data Import
npm run import:movies:single 1 20   # Import single page
npm run import:movies:multiple 1 5  # Import multiple pages

# Setup
npm run setup           # Run setup script
```

## 🐛 Troubleshooting

### Common Issues

1. **Firebase not initialized**
   ```bash
   firebase init
   ```

2. **Missing dependencies**
   ```bash
   npm install
   cd functions && npm install
   ```

3. **Environment variables not set**
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

4. **TMDB API errors**
   - Check your API key
   - Verify API key has correct permissions
   - Check rate limits

5. **Firestore permission errors**
   - Deploy security rules: `firebase deploy --only firestore`
   - Check rules syntax in `firestore.rules`

## 📚 Next Steps

1. **Connect Frontend**: Update Flutter app to use these API endpoints
2. **Add Authentication**: Implement Firebase Auth
3. **Add Analytics**: Set up Firebase Analytics
4. **Add Notifications**: Configure Firebase Cloud Messaging
5. **Scale**: Monitor usage and optimize performance

## 🆘 Need Help?

- 📖 Full Documentation: `README.md`
- 🔌 API Reference: `API_DOCUMENTATION.md`
- 🐛 Issues: Check Firebase Console logs
- 💬 Support: Create an issue in the repository

---

**Happy coding! 🎬✨** 