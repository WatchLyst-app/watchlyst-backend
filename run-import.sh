#!/bin/bash

echo "🎬 WatchLyst Comprehensive Movie Import"
echo "========================================"
echo ""
echo "This script will import ALL movies from TMDB using:"
echo "1. /discover/movie endpoint to find movies"
echo "2. /movie/{movie_id} to get detailed information"
echo "3. Include genres and all movie details"
echo "4. Skip movies that already exist in the database"
echo ""
echo "⚠️  This will take several hours and make thousands of API calls!"
echo ""

# Check environment
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with:"
    echo "TMDB_API_KEY=your_api_key_here"
    echo "FIREBASE_PROJECT_ID=your_project_id"
    echo "FIREBASE_PRIVATE_KEY=your_private_key"
    echo "FIREBASE_CLIENT_EMAIL=your_client_email"
    exit 1
fi

# Load environment variables
source .env

if [ -z "$TMDB_API_KEY" ]; then
    echo "❌ TMDB_API_KEY not set in .env file!"
    exit 1
fi

if [ -z "$FIREBASE_PROJECT_ID" ]; then
    echo "❌ FIREBASE_PROJECT_ID not set in .env file!"
    exit 1
fi

echo "✅ Environment check passed"
echo ""

# Ask for confirmation
read -p "Are you sure you want to start the comprehensive import? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Import cancelled"
    exit 1
fi

echo ""
echo "🚀 Starting comprehensive import..."
echo "This may take several hours..."
echo ""

# Run the comprehensive import
npm run import:comprehensive

echo ""
echo "✨ Import completed!" 