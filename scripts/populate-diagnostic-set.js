#!/usr/bin/env node

/**
 * Script to populate Firestore with Diagnostic Golden Set movies
 * Ensures all 150 seed movies are available for the recommendation system
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Import the diagnostic golden set
const diagnosticSet = require('../diagnostic-golden-set.js');

async function populateDiagnosticMovies() {
  console.log('🎬 Populating Diagnostic Golden Set...\n');
  
  const allMovies = diagnosticSet.getAllMovies();
  console.log(`Total movies to add: ${allMovies.length}`);
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const movie of allMovies) {
    try {
      const movieId = movie.tmdbId.toString();
      const movieRef = db.collection('movies').doc(movieId);
      
      // Check if movie already exists
      const movieDoc = await movieRef.get();
      
      if (movieDoc.exists) {
        console.log(`⏭️  Skipping ${movie.title} (${movie.year}) - already exists`);
        skipped++;
        continue;
      }
      
      // Add movie with minimal required fields
      // The full data will be fetched from TMDB later
      await movieRef.set({
        tmdbId: movie.tmdbId,
        title: movie.title,
        releaseDate: `${movie.year}-01-01`,
        overview: movie.description,
        diagnosticSeed: true, // Flag this as a diagnostic seed movie
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      }, { merge: true });
      
      console.log(`✅ Added ${movie.title} (${movie.year})`);
      added++;
      
    } catch (error) {
      console.error(`❌ Error adding ${movie.title}: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  ✅ Added: ${added}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('\n🎉 Done!');
}

// Run the script
populateDiagnosticMovies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
