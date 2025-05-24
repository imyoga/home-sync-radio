const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}║              HomeSync Radio Launcher               ║${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════╝${colors.reset}`);

// Check if the music directory exists and has files
const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) {
  console.log(`${colors.yellow}Creating music directory...${colors.reset}`);
  fs.mkdirSync(musicDir);
  console.log(`${colors.bright}${colors.yellow}Warning: No music files found. Please add MP3 or OGG files to the 'music' directory.${colors.reset}`);
} else {
  const files = fs.readdirSync(musicDir).filter(file => 
    file.toLowerCase().endsWith('.mp3') || file.toLowerCase().endsWith('.ogg')
  );
  
  if (files.length === 0) {
    console.log(`${colors.bright}${colors.yellow}Warning: No music files found. Please add MP3 or OGG files to the 'music' directory.${colors.reset}`);
  } else {
    console.log(`${colors.green}Found ${files.length} music files in the music directory.${colors.reset}`);
  }
}

// Start the traditional streaming server
console.log(`\n${colors.bright}${colors.blue}Starting traditional streaming server (app.js)...${colors.reset}`);
const traditionalServer = spawn('node', ['app.js'], { 
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
});

// Start the WebSocket synchronized server
console.log(`\n${colors.bright}${colors.magenta}Starting synchronized WebSocket server (server.js)...${colors.reset}`);
const syncServer = spawn('node', ['server.js'], { 
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
});

// Handle output from traditional server
traditionalServer.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    console.log(`${colors.blue}[Traditional] ${colors.reset}${line}`);
  });
});

traditionalServer.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    console.log(`${colors.red}[Traditional ERROR] ${line}${colors.reset}`);
  });
});

// Handle output from synchronized server
syncServer.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    console.log(`${colors.magenta}[Synchronized] ${colors.reset}${line}`);
  });
});

syncServer.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    console.log(`${colors.red}[Synchronized ERROR] ${line}${colors.reset}`);
  });
});

// Handle process exit
traditionalServer.on('close', (code) => {
  console.log(`${colors.yellow}Traditional server exited with code ${code}${colors.reset}`);
});

syncServer.on('close', (code) => {
  console.log(`${colors.yellow}Synchronized server exited with code ${code}${colors.reset}`);
});

// Handle application termination
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down servers...${colors.reset}`);
  
  // Kill child processes
  process.kill(-traditionalServer.pid);
  process.kill(-syncServer.pid);
  
  process.exit(0);
});

console.log(`\n${colors.green}Both servers are running!${colors.reset}`);
console.log(`${colors.cyan}Traditional HTTP Streaming: ${colors.bright}http://localhost:3001${colors.reset}`);
console.log(`${colors.cyan}Synchronized Playback:     ${colors.bright}http://localhost:3002${colors.reset}`);
console.log(`${colors.cyan}Choose player interface:   ${colors.bright}http://localhost:3002/choose-player.html${colors.reset}`);
console.log(`\n${colors.yellow}Press Ctrl+C to stop all servers${colors.reset}`); 