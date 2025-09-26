#!/bin/bash

# WatchLyst Phase 1 ML Recommendation System Deployment Script

echo "🚀 Deploying WatchLyst Phase 1 ML Recommendation System..."
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found. Please install it first:${NC}"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the watchlyst_backend directory${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Step 2: Install functions dependencies
echo -e "\n${YELLOW}📦 Installing Cloud Functions dependencies...${NC}"
cd functions
npm install
cd ..

# Step 3: Build TypeScript functions
echo -e "\n${YELLOW}🔨 Building Cloud Functions...${NC}"
cd functions
npm run build
cd ..

# Step 4: Deploy Firestore rules
echo -e "\n${YELLOW}🔒 Deploying Firestore security rules...${NC}"
firebase deploy --only firestore:rules

# Step 5: Deploy Firestore indexes
echo -e "\n${YELLOW}📇 Deploying Firestore indexes...${NC}"
firebase deploy --only firestore:indexes

# Step 6: Deploy Cloud Functions
echo -e "\n${YELLOW}☁️  Deploying Cloud Functions...${NC}"
firebase deploy --only functions

# Step 7: Update movie feature vectors
echo -e "\n${YELLOW}🎬 Scheduling movie feature vector update...${NC}"
firebase functions:shell << EOF
updateMovieFeatures({})
exit
EOF

# Step 8: Display success message
echo -e "\n${GREEN}✅ Phase 1 ML Recommendation System deployed successfully!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Update Flutter app dependencies: cd ../watchlyst_frontend_flutter && flutter pub get"
echo "2. Run the Flutter app and test the recommendation system"
echo "3. Access ML Debug Dashboard from Settings > Developer"
echo "4. Monitor function logs: firebase functions:log --follow"
echo -e "\n${YELLOW}Testing commands:${NC}"
echo "- View function logs: firebase functions:log"
echo "- Query interactions: firebase firestore:query interactions --limit 10"
echo "- Check user preferences: firebase firestore:read userPreferences/USER_ID"
echo -e "\n${GREEN}🎉 Happy swiping!${NC}"
