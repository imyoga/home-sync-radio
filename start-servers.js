const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎵 HomeSync Radio - Starting Server...\n');

// Check if the music directory exists and has files
const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) {
  console.log('📁 Creating music directory...');
  fs.mkdirSync(musicDir);
  console.log('⚠️  No music files found. Please add MP3 or OGG files to the "music" directory.\n');
} else {
  const files = fs.readdirSync(musicDir).filter(file => 
    file.toLowerCase().endsWith('.mp3') || file.toLowerCase().endsWith('.ogg')
  );
  
  if (files.length === 0) {
    console.log('⚠️  No music files found. Please add MP3 or OGG files to the "music" directory.\n');
  } else {
    console.log(`✅ Found ${files.length} music files in the music directory.\n`);
  }
}

// Start the synchronized server
const server = spawn('node', ['server.js'], { 
  stdio: 'inherit'
});

// Handle process exit
server.on('close', (code) => {
  console.log(`\n🛑 Server stopped with exit code ${code}`);
  process.exit(code);
});

// Handle application termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down HomeSync Radio...');
  server.kill();
  process.exit(0);
});

console.log('🎧 Listen at:     http://localhost:3002');
console.log('🛠️  Admin Panel:  http://localhost:3002/admin');
console.log('\n📻 Press Ctrl+C to stop the server\n'); 