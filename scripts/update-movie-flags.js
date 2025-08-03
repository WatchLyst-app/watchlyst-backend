const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updateMovieFlags() {
  try {
    console.log('🔄 Updating existing movies with category flags...');
    
    // Get all existing movies
    const snapshot = await db.collection('movies').get();
    console.log(`📊 Found ${snapshot.size} movies to update`);
    
    const batch = db.batch();
    const timestamp = admin.firestore.Timestamp.now();
    let updatedCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Set default flags based on existing category or popularity
      const movieData = {
        ...data,
        isPopular: data.isPopular || data.popularity > 100 || false,
        isTrending: data.isTrending || false,
        isTopRated: data.isTopRated || (data.voteAverage >= 7.5 && data.voteCount > 100) || false,
        isNowPlaying: data.isNowPlaying || false,
        isUpcoming: data.isUpcoming || false,
        updatedAt: timestamp,
      };
      
      const movieRef = db.collection('movies').doc(doc.id);
      batch.update(movieRef, movieData);
      updatedCount++;
    });
    
    await batch.commit();
    console.log(`✅ Updated ${updatedCount} movies with category flags`);
    
    // Show sample of updated movies
    const sampleSnapshot = await db.collection('movies').limit(5).get();
    console.log(`\n📋 Sample of updated movies:`);
    
    sampleSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const flags = [];
      if (data.isTrending) flags.push('🔥 Trending');
      if (data.isPopular) flags.push('⭐ Popular');
      if (data.isTopRated) flags.push('🏆 Top Rated');
      if (data.isNowPlaying) flags.push('🎬 Now Playing');
      if (data.isUpcoming) flags.push('📅 Upcoming');
      
      console.log(`  ${index + 1}. ${data.title} - Rating: ${data.voteAverage}/10`);
      console.log(`     Flags: ${flags.length > 0 ? flags.join(', ') : 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  }
}

updateMovieFlags().then(() => {
  console.log('\n✨ Flag update completed!');
  process.exit(0);
}).catch(error => {
  console.error('Flag update failed:', error);
  process.exit(1);
}); 