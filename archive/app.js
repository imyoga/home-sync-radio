const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 3001;

// Radio state
let radioStartTime = Date.now();
let isPlaying = false;
let currentTrackIndex = 0;
let musicFiles = [];
let currentTrack = null;
let pausedPosition = 0;

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
    } else {
      console.log("❌ No music files found in music directory");
    }
  } catch (error) {
    console.error("❌ Error loading music files:", error);
    musicFiles = [];
  }
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

// Calculate byte offset based on current position
function getCurrentByteOffset() {
  if (!currentTrack) return 0;
  
  let position;
  if (isPlaying) {
    position = getCurrentPosition();
  } else {
    // When paused, use the saved position
    position = pausedPosition / currentTrack.estimatedDurationMs;
  }
  
  return Math.floor(currentTrack.size * position);
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
    return true;
  }
  return false;
}

// Console logging every second
function startStatusLogging() {
  setInterval(() => {
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

      console.log(
        `📻 ${status} | ${trackInfo} | ${timeDisplay} (${progress}%)`
      );
    } else {
      console.log(`📻 ${isPlaying ? "▶️" : "⏸️"} NO TRACK LOADED`);
    }
  }, 1000);
}

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Stream audio from current position
app.get("/stream", (req, res) => {
  if (!currentTrack) {
    return res.status(404).json({ error: "No music available" });
  }
  
  if (!isPlaying) {
    return res.status(200).json({ status: "paused", message: "Radio is currently paused" });
  }

  checkTrackChange(); // Check if we need to switch tracks

  const startByte = getCurrentByteOffset();
  const endByte = currentTrack.size - 1;
  const contentLength = endByte - startByte + 1;

  // Set headers for better streaming
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Content-Length": contentLength,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Stream-Position": startByte,
    "X-Track-Duration": currentTrack.estimatedDurationMs,
    "X-Track-Index": currentTrackIndex
  });

  // Create stream from current position with higher priority
  const stream = fs.createReadStream(currentTrack.path, {
    start: startByte,
    end: endByte,
    highWaterMark: 65536 // 64KB chunks for faster initial loading
  });

  // Handle streaming errors
  stream.on('error', (err) => {
    console.error(`Streaming error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).send('Streaming error occurred');
    }
  });

  stream.pipe(res);

  // Handle client disconnect
  req.on("close", () => {
    stream.destroy();
  });

  req.on("aborted", () => {
    stream.destroy();
  });
});

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
  });
});

// Serve admin panel
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`🎵 HomeSync Radio Server running at http://localhost:${PORT}`);
  console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin`);
  if (currentTrack) {
    console.log(`🎧 Available Track: ${currentTrack.name}`);
    console.log(`📅 Radio initialized at: ${new Date(radioStartTime).toLocaleTimeString()}`);
    if (isPlaying) {
      console.log(`▶️ Radio is PLAYING automatically.`);
    } else {
      console.log(`⏸️ Radio is PAUSED. Use admin panel to start playback.`);
    }
  }
  console.log(`📻 Starting status logging...`);

  // Start console logging
  startStatusLogging();
});
