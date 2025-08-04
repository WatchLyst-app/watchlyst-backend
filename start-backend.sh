#!/bin/bash

echo "🚀 Starting WatchLyst Backend..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it with: npm install -g firebase-tools"
    exit 1
fi

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install
cd functions && npm install && cd ..

# Build functions
echo "🔨 Building Firebase Functions..."
cd functions && npm run build && cd ..

# Start Firebase emulators
echo "🔥 Starting Firebase Emulators..."
echo "📍 Functions will be available at: http://localhost:5001"
echo "📍 Emulator UI will be available at: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop the emulators"
echo ""

firebase emulators:start --only functions,firestore --project watchlyst-app 