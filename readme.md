# HomeSync Radio - Version 1.0.0 Release Notes

## 🎉 Key Features

*   **Synchronized Playback (WebSocket & Web Audio API):**
    *   Ensures all connected clients hear the exact same audio at the exact same millisecond.
    *   Leverages WebSockets for real-time communication and Web Audio API for precise, low-latency audio control.
    *   Server shares its clock and sends timing information to keep all clients perfectly aligned.
    *   Audio is preloaded on clients to minimize buffering delays.
*   **Traditional HTTP Streaming Player:**
    *   Provides a standard internet radio-like experience using HTTP streaming.
    *   Compatible with a wide range of browsers and devices using a simple HTML5 `<audio>` player.
*   **Admin Control Panel (`/admin/index.html`):**
    *   Remotely manage the radio playback: Play, Pause, Stop.
    *   Select specific tracks from the music library.
    *   View the currently playing track and its progress.
    *   Monitor connected clients (total, listeners, admins).
*   **Music Library Management:**
    *   Automatically loads MP3 files from a `music/` directory in the server's root.
    *   Displays available tracks in the admin panel.
    *   Supports automatic track changes upon completion.
*   **Client Options:**
    *   **synchronized Player (`/index.html`):** For traditional streaming.
*   **Real-time Status Updates:**
    *   Both admin and players show real-time status of playback and track information.

## 🚀 Getting Started

1.  **Installation:**
    ```bash
    yarn install
    ```
2.  **Add Music:**
    *   Create a folder named `music` in the root directory of the project.
    *   Add your MP3 or OGG audio files to this `music/` folder.
3.  **Start the Servers:**
    *   For the primary synchronized server and admin panel (recommended):
        ```bash
        yarn start
        ```

## 🎧 How to Listen
*   Open your browser and navigate to `http://localhost:3002/index.html`. Voila! 

## 🛠️ Admin Access
*   Navigate to `http://localhost:3002/admin/index.html` to control the radio.

## 📡 API Documentation

### WebSocket API

The radio uses WebSocket connections for real-time communication and audio synchronization.

**Connection URL:** `ws://localhost:3002` (or `wss://` for HTTPS)

#### Client → Server Messages

| Message Type | Description | Payload | Client Type |
|-------------|-------------|---------|-------------|
| `identify` | Identify client type | `{ type: "identify", clientType: "listener" \| "admin" }` | Both |
| `requestSync` | Request sync data | `{ type: "requestSync" }` | Both |
| `getTrackList` | Get available tracks | `{ type: "getTrackList" }` | Admin |
| `getPlaybackState` | Get current playback state | `{ type: "getPlaybackState" }` | Admin |

#### Server → Client Messages

| Message Type | Description | Payload | Sent To |
|-------------|-------------|---------|---------|
| `initial` | Initial connection data | Full track info, state, audio buffer | New clients |
| `sync` | Synchronization data | Timing and track info | All clients |
| `tracks` | Available tracks list | Track metadata array | Admin |
| `playbackState` | Current playback state | Playing status, position | All clients |
| `trackChange` | Track changed | New track info | All clients |

#### WebSocket Message Examples

**Client Identification:**
```json
{
  "type": "identify",
  "clientType": "listener"
}
```

**Sync Response:**
```json
{
  "type": "sync",
  "serverTime": 1699123456789,
  "trackId": "track_001",
  "trackName": "Song Title.mp3",
  "isPlaying": true,
  "startTime": 1699123400000,
  "currentPosition": 56789,
  "trackDuration": 240000,
  "clients": {
    "total": 5,
    "listeners": 4,
    "admins": 1
  }
}
```

### HTTP REST API

#### Radio Control Endpoints

**Base URL:** `http://localhost:3002/api`

#### POST `/api/radio/control/:action`

Control radio playback.

**Parameters:**
- `action` (path): `play` | `pause` | `stop` | `select`
- `trackId` (body, optional): Track ID for `select` action

**Request Examples:**
```bash
# Play
curl -X POST http://localhost:3002/api/radio/control/play

# Pause
curl -X POST http://localhost:3002/api/radio/control/pause

# Stop
curl -X POST http://localhost:3002/api/radio/control/stop

# Select track
curl -X POST http://localhost:3002/api/radio/control/select \
  -H "Content-Type: application/json" \
  -d '{"trackId": "track_001"}'
```

**Response:**
```json
{
  "success": true,
  "message": "▶️ Radio RESUMED - Now playing: Song Title.mp3",
  "isPlaying": true,
  "currentTrack": "Song Title.mp3",
  "currentTrackIndex": 0,
  "startTime": 1699123456789,
  "clients": {
    "total": 5,
    "listeners": 4,
    "admins": 1
  }
}
```

#### GET `/api/radio/status`

Get current radio status.

**Response:**
```json
{
  "isPlaying": true,
  "currentTrack": {
    "id": "track_001",
    "name": "Song Title.mp3",
    "filename": "Song Title.mp3",
    "duration": 240
  },
  "currentTrackIndex": 0,
  "currentPosition": 56789,
  "currentTimeSeconds": 56,
  "pausedPosition": 0,
  "startTime": 1699123456789,
  "totalTracks": 10,
  "clients": {
    "total": 5,
    "listeners": 4,
    "admins": 1
  }
}
```

#### Tracks Endpoints

#### GET `/api/tracks`

Get all available tracks.

**Response:**
```json
{
  "tracks": [
    {
      "id": "track_001",
      "name": "Song Title.mp3",
      "filename": "Song Title.mp3",
      "duration": 240
    }
  ],
  "currentTrackIndex": 0,
  "total": 10
}
```

### Client Types

#### Listener Client (`/index.html`)
- Receives audio data via WebSocket
- Synchronizes playback using Web Audio API
- Shows real-time track progress
- Volume control

#### Admin Client (`/admin/index.html`)
- Full radio control interface
- Track selection and management
- Client monitoring
- No audio playback

### Audio Synchronization

The synchronized player uses a sophisticated timing system:

1. **Clock Synchronization**: Server sends timestamps to calculate client-server time offset
2. **Audio Streaming**: Complete audio files sent via WebSocket for instant playback
3. **Position Calculation**: Clients calculate exact playback position using server timestamps
4. **Automatic Sync**: Periodic sync requests ensure long-term accuracy

## Browser Support

*   **Synchronized Player:** Requires modern browsers with WebSockets, Web Audio API, and ES6 JavaScript support.

## Known Issues & Notes
- Audio context requires user interaction to start (browser security requirement)
- WebSocket connections auto-reconnect on failure
- Large audio files may take time to initially load
