const fs = require('fs');
const path = require('path');

console.log('🎬 WatchLyst Backend Setup');
console.log('==========================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', 'env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created successfully!');
    console.log('⚠️  Please update the .env file with your Firebase and TMDB credentials.');
  } else {
    console.log('❌ env.example file not found!');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('\n📦 Installing dependencies...');
  console.log('Run: npm install');
} else {
  console.log('\n✅ Dependencies already installed');
}

// Check if functions/node_modules exists
const functionsNodeModulesPath = path.join(__dirname, '..', 'functions', 'node_modules');
if (!fs.existsSync(functionsNodeModulesPath)) {
  console.log('\n📦 Installing Firebase Functions dependencies...');
  console.log('Run: cd functions && npm install');
} else {
  console.log('\n✅ Firebase Functions dependencies already installed');
}

console.log('\n🚀 Setup Steps:');
console.log('1. Update .env file with your credentials');
console.log('2. Run: npm install');
console.log('3. Run: cd functions && npm install');
console.log('4. Run: firebase login');
console.log('5. Run: firebase init');
console.log('6. Run: firebase deploy');
console.log('7. Run: npm run import:movies:multiple 1 5');

console.log('\n📚 Documentation:');
console.log('- README.md: Complete setup guide');
console.log('- API endpoints: http://localhost:3000');

console.log('\n🎯 Next Steps:');
console.log('- Get TMDB API key from: https://www.themoviedb.org/settings/api');
console.log('- Create Firebase project at: https://console.firebase.google.com/');
console.log('- Download Firebase service account key');
console.log('- Update .env file with your credentials');

console.log('\n✨ Happy coding!'); 