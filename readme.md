# HomeSync Radio

A synchronized audio streaming server that ensures all listeners hear the exact same audio at the exactly same time. The system provides two ways to listen:

1. **Traditional HTTP Streaming** - Similar to regular internet radio
2. **Synchronized WebSocket Playback** - Perfect synchronization across all clients using Web Audio API

## Features

- **Perfect Synchronization**: All clients hear the same audio at the exact same time
- **Admin Control Panel**: Play, pause, stop, and select tracks remotely
- **Multiple Player Options**: Choose the player that works best for your needs
- **Automatic Track Changes**: Seamless transitions between tracks
- **Real-time Status Updates**: See playback status and connected clients

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a music directory**
   Create a folder named `music` in the root directory and add your MP3 or OGG files.

3. **Start the synchronized server**
   ```
   npm start
   ```
   
   OR start the traditional streaming server:
   ```
   npm run start:legacy
   ```

## Usage

### Client Access
Access the main landing page:
```
http://localhost:3002/choose-player.html
```

From there, choose your preferred player:
- **Standard Player**: Works on all browsers with HTTP streaming
- **Synchronized Player**: Perfect timing synchronization using WebSockets and Web Audio API

### Admin Panel
Access the admin control panel:
```
http://localhost:3002/admin
```

From the admin panel, you can:
- Play/pause/stop the radio
- Select specific tracks
- See connected clients
- Monitor playback status

## How It Works

### Traditional HTTP Streaming (app.js)
- Uses standard HTTP streaming at port 3001
- Each client independently buffers and plays the audio stream
- Clients may hear audio at slightly different times

### Synchronized WebSocket Streaming (server.js)
- Uses WebSockets to synchronize playback at port 3002
- Server sends audio data and precise timing information
- Web Audio API ensures all clients play at exactly the same position
- Regular sync messages keep all clients in perfect alignment

## Technical Details

The synchronization system works through several mechanisms:

1. **Server clock sharing**: The server shares its clock with clients to establish a time reference
2. **Audio preloading**: The entire audio track is preloaded to eliminate buffering delays
3. **Precise playback timing**: Web Audio API provides sample-accurate playback control
4. **Regular sync checks**: Clients periodically verify and adjust playback position

## Browser Support

The synchronized player requires modern browsers with support for:
- WebSockets
- Web Audio API
- ES6 JavaScript

The traditional player works on virtually all browsers with HTML5 audio support.

## License
MIT