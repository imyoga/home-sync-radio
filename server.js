const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 3002;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Radio state
let radioStartTime = Date.now();
let isPlaying = false;
let currentTrackIndex = 0;
let musicFiles = [];
let currentTrack = null;
let pausedPosition = 0;
let clients = [];
let audioBuffer = null;
let audioContext = null;

// Music directory
const musicDir = path.join(__dirname, "music");

// Load all music files from the music directory
function loadMusicFiles() {
  try {
    const files = fs.readdirSync(musicDir);
    musicFiles = files
      .filter(
        (file) =>
          file.toLowerCase().endsWith(".mp3") ||
          file.toLowerCase().endsWith(".ogg")
      )
      .map((file, index) => {
        const filePath = path.join(musicDir, file);
        const stat = fs.statSync(filePath);
        return {
          id: index,
          filename: file,
          name: file.replace(/\.[^/.]+$/, ""), // Remove extension for display
          path: filePath,
          size: stat.size,
          // Estimate duration based on file size (approximate for MP3)
          estimatedDurationMs: (stat.size * 8) / (128000 / 1000), // Assuming 128kbps
        };
      });

    if (musicFiles.length > 0) {
      currentTrack = musicFiles[0];
      console.log(`🎵 Loaded ${musicFiles.length} music files`);
      musicFiles.forEach((track, i) => {
        console.log(
          `   ${i}: ${track.name} (${Math.round(
            track.estimatedDurationMs / 1000
          )}s)`
        );
      });
      
      // Load the first track
      preloadCurrentTrack();
    } else {
      console.log("❌ No music files found in music directory");
    }
  } catch (error) {
    console.error("❌ Error loading music files:", error);
    musicFiles = [];
  }
}

// Preload the current track into memory
function preloadCurrentTrack() {
  if (!currentTrack) return;
  
  fs.readFile(currentTrack.path, (err, data) => {
    if (err) {
      console.error('Error reading audio file:', err);
      return;
    }
    
    audioBuffer = data;
    console.log(`🎵 Preloaded: ${currentTrack.name} (${Math.round(audioBuffer.length / 1024)} KB)`);
  });
}

// Initialize music files
loadMusicFiles();

// Set radio to play automatically when server starts
isPlaying = true;

// Get current playback position in the current track
function getCurrentPosition() {
  if (!currentTrack) return 0;
  
  if (isPlaying) {
    const elapsed = Date.now() - radioStartTime;
    const position = elapsed % currentTrack.estimatedDurationMs;
    return position / currentTrack.estimatedDurationMs; // Return as percentage (0-1)
  } else {
    // When paused, return the saved position
    return pausedPosition / currentTrack.estimatedDurationMs;
  }
}

// Get current time in milliseconds
function getCurrentTimeMs() {
  if (!currentTrack) return 0;
  
  if (isPlaying) {
    return (Date.now() - radioStartTime) % currentTrack.estimatedDurationMs;
  } else {
    return pausedPosition;
  }
}

// Format time for logging
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Check if current track should switch to next
function checkTrackChange() {
  if (!currentTrack || !isPlaying) return false;

  const elapsed = Date.now() - radioStartTime;
  if (elapsed >= currentTrack.estimatedDurationMs) {
    // Move to next track
    const oldTrack = currentTrack.name;
    currentTrackIndex = (currentTrackIndex + 1) % musicFiles.length;
    currentTrack = musicFiles[currentTrackIndex];
    radioStartTime = Date.now();
    pausedPosition = 0; // Reset paused position on track change
    console.log(`🔄 Auto-switched: ${oldTrack} → ${currentTrack.name}`);
    
    // Preload the new track
    preloadCurrentTrack();
    
    // Notify all connected clients about track change
    broadcastTrackChange();
    
    return true;
  }
  return false;
}

// Broadcast track change to all connected clients
function broadcastTrackChange() {
  const message = JSON.stringify({
    type: 'trackChange',
    trackId: currentTrack.id,
    trackName: currentTrack.name,
    serverTime: Date.now(),
    startTime: radioStartTime
  });
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast playback state change to all connected clients
function broadcastPlaybackState() {
  const message = JSON.stringify({
    type: 'playbackState',
    isPlaying: isPlaying,
    serverTime: Date.now(),
    currentPosition: getCurrentTimeMs(),
    startTime: radioStartTime
  });
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Console logging every second
function startStatusLogging() {
  setInterval(() => {
    checkTrackChange(); // Check if we need to change tracks
    
    if (currentTrack) {
      // Calculate current position
      let currentTime;
      if (isPlaying) {
        currentTime = (Date.now() - radioStartTime) % currentTrack.estimatedDurationMs;
      } else {
        currentTime = pausedPosition; // Use the saved position when paused
      }
      
      const totalTime = currentTrack.estimatedDurationMs;
      const progress = ((currentTime / totalTime) * 100).toFixed(1);

      const status = isPlaying ? "▶️ PLAYING" : "⏸️ PAUSED";
      const timeDisplay = `${formatTime(currentTime)}/${formatTime(totalTime)}`;
      const trackInfo = `[${currentTrackIndex + 1}/${musicFiles.length}] ${
        currentTrack.name
      }`;
      const clientInfo = `👥 ${clients.length} connected clients`;

      console.log(
        `📻 ${status} | ${trackInfo} | ${timeDisplay} (${progress}%) | ${clientInfo}`
      );
    } else {
      console.log(`📻 ${isPlaying ? "▶️" : "⏸️"} NO TRACK LOADED | 👥 ${clients.length} clients`);
    }
  }, 1000);
}

// Send sync message to all clients every 5 seconds
function startSyncBroadcast() {
  setInterval(() => {
    const syncData = {
      type: 'sync',
      serverTime: Date.now(),
      trackId: currentTrack ? currentTrack.id : null,
      isPlaying: isPlaying,
      startTime: radioStartTime,
      currentPosition: getCurrentTimeMs(),
      trackDuration: currentTrack ? currentTrack.estimatedDurationMs : 0
    };
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(syncData));
      }
    });
  }, 5000);
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`🔌 New WebSocket client connected: ${clientIP}`);
  
  // Add to clients list
  clients.push(ws);
  
  // Send initial track data
  if (currentTrack) {
    ws.send(JSON.stringify({
      type: 'initial',
      trackId: currentTrack.id,
      trackName: currentTrack.name,
      isPlaying: isPlaying,
      serverTime: Date.now(),
      startTime: radioStartTime,
      currentPosition: getCurrentTimeMs(),
      trackDuration: currentTrack.estimatedDurationMs,
      tracks: musicFiles.map(track => ({
        id: track.id,
        name: track.name
      }))
    }));
    
    // Send audio data if available
    if (audioBuffer) {
      console.log(`📤 Sending audio data to client: ${Math.round(audioBuffer.length / 1024)} KB`);
      ws.send(audioBuffer);
    }
  }
  
  // Handle WebSocket messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📩 Received message: ${data.type}`);
      
      if (data.type === 'requestSync') {
        // Client requested a sync update
        ws.send(JSON.stringify({
          type: 'sync',
          serverTime: Date.now(),
          trackId: currentTrack ? currentTrack.id : null,
          isPlaying: isPlaying,
          startTime: radioStartTime,
          currentPosition: getCurrentTimeMs(),
          trackDuration: currentTrack ? currentTrack.estimatedDurationMs : 0
        }));
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`🔌 WebSocket client disconnected: ${clientIP}`);
    clients = clients.filter(client => client !== ws);
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// API to get all available tracks
app.get("/api/tracks", (req, res) => {
  res.json({
    tracks: musicFiles.map((track) => ({
      id: track.id,
      name: track.name,
      filename: track.filename,
      duration: Math.round(track.estimatedDurationMs / 1000),
    })),
    currentTrackIndex,
    total: musicFiles.length,
  });
});

// API to get current radio status
app.get("/api/radio-status", (req, res) => {
  checkTrackChange(); // Update track if needed

  let currentTimeSeconds;
  if (isPlaying) {
    currentTimeSeconds = Math.round(
      ((Date.now() - radioStartTime) %
        (currentTrack?.estimatedDurationMs || 1)) /
        1000
    );
  } else {
    currentTimeSeconds = Math.round(pausedPosition / 1000);
  }

  res.json({
    isPlaying,
    currentTrack: currentTrack
      ? {
          id: currentTrack.id,
          name: currentTrack.name,
          filename: currentTrack.filename,
          duration: Math.round(currentTrack.estimatedDurationMs / 1000),
        }
      : null,
    currentTrackIndex,
    currentPosition: getCurrentPosition(),
    currentTimeSeconds: currentTimeSeconds,
    pausedPosition: Math.round(pausedPosition / 1000),
    startTime: radioStartTime,
    totalTracks: musicFiles.length,
    connectedClients: clients.length
  });
});

// API to control radio
app.post("/api/control/:action", (req, res) => {
  const { action } = req.params;
  const { trackId } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || "unknown";

  console.log(`🎛️ ADMIN ACTION: ${action.toUpperCase()} from ${clientIP}`);

  switch (action) {
    case "play":
      if (!isPlaying) {
        if (pausedPosition > 0) {
          // Resume from paused position
          radioStartTime = Date.now() - pausedPosition;
        } else {
          // Start fresh
          radioStartTime = Date.now();
        }
        isPlaying = true;
        console.log(
          `   ▶️ Radio RESUMED - Now playing: ${currentTrack?.name || "None"}`
        );
        broadcastPlaybackState();
      } else {
        console.log(`   ⚠️ Radio was already playing`);
      }
      break;

    case "pause":
      if (isPlaying) {
        // Save current position when pausing
        pausedPosition = (Date.now() - radioStartTime) % (currentTrack?.estimatedDurationMs || 1);
        isPlaying = false;
        console.log(
          `   ⏸️ Radio PAUSED - Was playing: ${currentTrack?.name || "None"} at position ${formatTime(pausedPosition)}`
        );
        broadcastPlaybackState();
      } else {
        console.log(`   ⚠️ Radio was already paused`);
      }
      break;

    case "stop":
      isPlaying = false;
      radioStartTime = Date.now();
      pausedPosition = 0;
      console.log(
        `   ⏹️ Radio STOPPED and RESET - Track: ${currentTrack?.name || "None"}`
      );
      broadcastPlaybackState();
      break;

    case "select":
      if (trackId !== undefined && musicFiles[trackId]) {
        const oldTrack = currentTrack?.name || "None";
        currentTrackIndex = trackId;
        currentTrack = musicFiles[currentTrackIndex];
        radioStartTime = Date.now();
        pausedPosition = 0;
        console.log(
          `   🎯 TRACK SELECTED: ${oldTrack} → ${currentTrack.name} (ID: ${trackId})`
        );
        preloadCurrentTrack();
        broadcastTrackChange();
      } else {
        console.log(`   ⚠️ Invalid track selection - ID: ${trackId}`);
      }
      break;

    default:
      console.log(`   ❌ Unknown action: ${action}`);
  }

  res.json({
    success: true,
    isPlaying,
    currentTrack: currentTrack ? currentTrack.name : null,
    currentTrackIndex,
    startTime: radioStartTime,
    connectedClients: clients.length
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`🎵 HomeSync Synchronized Radio Server running at http://localhost:${PORT}`);
  console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin`);
  
  if (currentTrack) {
    console.log(`🎧 Current Track: ${currentTrack.name}`);
    console.log(`📅 Radio initialized at: ${new Date(radioStartTime).toLocaleTimeString()}`);
    if (isPlaying) {
      console.log(`▶️ Radio is PLAYING automatically.`);
    } else {
      console.log(`⏸️ Radio is PAUSED. Use admin panel to start playback.`);
    }
  }
  
  console.log(`🔄 Starting sync broadcast service...`);
  startSyncBroadcast();
  
  console.log(`📻 Starting status logging...`);
  startStatusLogging();
}); 