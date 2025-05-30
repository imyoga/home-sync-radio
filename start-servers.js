const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎵 HomeSync Radio - Starting Server...\n');

// Check if the music directory exists (create if missing, but don't log details)
const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) {
  console.log('📁 Creating music directory...');
  fs.mkdirSync(musicDir);
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

console.log('📻 Press Ctrl+C to stop the server\n'); 