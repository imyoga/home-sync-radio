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


## Browser Support

*   **Synchronized Player:** Requires modern browsers with WebSockets, Web Audio API, and ES6 JavaScript support.

## Known Issues & Notes
- 
