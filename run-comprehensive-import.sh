#!/bin/bash

echo "🚀 Starting Comprehensive Movie Import from TMDB..."
echo "This will import ALL movies using /discover/movie endpoint"
echo "and get detailed information including genres for each movie."
echo ""
echo "⚠️  This process may take several hours and will make many API calls."
echo "Make sure your TMDB API key is set in .env file"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please create one with your TMDB_API_KEY"
    exit 1
fi

# Check if TMDB_API_KEY is set
if ! grep -q "TMDB_API_KEY" .env; then
    echo "❌ TMDB_API_KEY not found in .env file!"
    exit 1
fi

echo "✅ Environment check passed"
echo ""

# Run the comprehensive import
echo "🎬 Running comprehensive import..."
npm run import:comprehensive

echo ""
echo "✨ Comprehensive import completed!" 