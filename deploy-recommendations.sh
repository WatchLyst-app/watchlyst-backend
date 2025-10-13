#!/bin/bash

# WatchLyst Recommendation System Deployment Script
# This script deploys the complete recommendation system to Firebase

set -e

echo "🎬 WatchLyst Recommendation System Deployment"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI is not installed"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

print_success "Firebase CLI found"

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    print_error "Not logged in to Firebase"
    echo "Run: firebase login"
    exit 1
fi

print_success "Logged in to Firebase"

# Step 1: Install dependencies
echo ""
print_info "Step 1: Installing dependencies..."
cd functions
npm install
cd ..
print_success "Dependencies installed"

# Step 2: Build TypeScript
echo ""
print_info "Step 2: Building TypeScript..."
cd functions
npm run build
if [ $? -eq 0 ]; then
    print_success "TypeScript build successful"
else
    print_error "TypeScript build failed"
    exit 1
fi
cd ..

# Step 3: Deploy Firestore indexes
echo ""
print_info "Step 3: Deploying Firestore indexes..."
firebase deploy --only firestore:indexes --non-interactive
if [ $? -eq 0 ]; then
    print_success "Firestore indexes deployed"
else
    print_warning "Firestore indexes deployment had issues (may need manual creation)"
fi

# Step 4: Deploy Firestore rules
echo ""
print_info "Step 4: Deploying Firestore security rules..."
firebase deploy --only firestore:rules --non-interactive
if [ $? -eq 0 ]; then
    print_success "Firestore rules deployed"
else
    print_error "Firestore rules deployment failed"
    exit 1
fi

# Step 5: Deploy Cloud Functions
echo ""
print_info "Step 5: Deploying Cloud Functions..."
print_info "This may take a few minutes..."
firebase deploy --only functions --non-interactive

if [ $? -eq 0 ]; then
    print_success "Cloud Functions deployed"
else
    print_error "Cloud Functions deployment failed"
    exit 1
fi

# Step 6: List deployed functions
echo ""
print_info "Deployed Cloud Functions:"
firebase functions:list

# Step 7: Test deployment
echo ""
print_info "Step 7: Running post-deployment tests..."

# Get project ID
PROJECT_ID=$(firebase projects:list | grep "(current)" | awk '{print $1}')
print_info "Project ID: $PROJECT_ID"

echo ""
print_success "=============================================="
print_success "Deployment Complete! 🎉"
print_success "=============================================="
echo ""
print_info "Deployed functions:"
echo "  - processSwipeInteraction (Firestore trigger)"
echo "  - generateInitialRecommendations (Callable)"
echo "  - refreshRecommendations (Callable)"
echo "  - getUserScoringDetails (Callable)"
echo "  - populateMovieFeatures (Callable)"
echo "  - updateMovieFeatures (Scheduled)"
echo ""
print_info "Next steps:"
echo "  1. Test the recommendation system in your Flutter app"
echo "  2. Monitor Cloud Function logs: firebase functions:log --follow"
echo "  3. Check Firestore for user interactions and preferences"
echo ""
print_info "Documentation: See RECOMMENDATION_SYSTEM.md for details"
echo ""


