# HomeSync Radio - Version 1.0.0 Release Notes

**Release Date:** (Leave as TBD or ask user for date)

We are excited to announce the first official release of HomeSync Radio, your self-hostable solution for synchronized audio streaming! Version 1.0.0 brings a stable platform for listening to music together, perfectly in sync, or via traditional streaming methods.

## 🎉 Key Features

*   **Synchronized Playback (WebSocket & Web Audio API):**
    *   Ensures all connected clients (using the Synchronized Player) hear the exact same audio at the exact same millisecond.
    *   Leverages WebSockets for real-time communication and Web Audio API for precise, low-latency audio control.
    *   Server shares its clock and sends timing information to keep all clients perfectly aligned.
    *   Audio is preloaded on clients to minimize buffering delays.
*   **Traditional HTTP Streaming Player:**
    *   Provides a standard internet radio-like experience using HTTP streaming.
    *   Compatible with a wide range of browsers and devices using a simple HTML5 `<audio>` player.
*   **Admin Control Panel (`/admin`):**
    *   Remotely manage the radio playback: Play, Pause, Stop.
    *   Select specific tracks from the music library.
    *   View the currently playing track and its progress.
    *   Monitor connected clients (total, listeners, admins).
*   **Music Library Management:**
    *   Automatically loads MP3 and OGG files from a `music/` directory in the server's root.
    *   Displays available tracks in the admin panel.
    *   Supports automatic track changes upon completion.
*   **Client Options:**
    *   **Choose Player Page (`/choose-player.html`):** Allows users to select their preferred listening experience.
    *   **Synchronized Player (`/sync-player.html`):** For the perfectly timed experience.
    *   **Standard Player (`/index.html`):** For traditional streaming.
*   **Real-time Status Updates:**
    *   Both admin and players show real-time status of playback and track information.

## 🚀 Getting Started

1.  **Installation:**
    ```bash
    npm install
    ```
2.  **Add Music:**
    *   Create a folder named `music` in the root directory of the project.
    *   Add your MP3 or OGG audio files to this `music/` folder.
3.  **Start the Servers:**
    *   For the primary synchronized server and admin panel (recommended):
        ```bash
        npm start
        ```
        This runs `server.js` and makes the synchronized player available at `http://localhost:3002/sync-player.html` and the admin panel at `http://localhost:3002/admin`.
    *   For the traditional HTTP streaming server (if `app.js` is configured and available):
        ```bash
        npm run start:legacy
        ```
        This typically runs `app.js` and serves the stream at `http://localhost:3001`. The standard player (`/index.html`) would connect to this.
    *   To run both (requires `nodemon` and `start-servers.js` to be configured):
        ```bash
        npm run start:all
        ```

## 🎧 How to Listen

1.  Open your browser and navigate to `http://localhost:3002/choose-player.html`.
2.  Select either the "Standard Player" or the "Synchronized Player".

## 🛠️ Admin Access

*   Navigate to `http://localhost:3002/admin` to control the radio.

## Browser Support

*   **Synchronized Player:** Requires modern browsers with WebSockets, Web Audio API, and ES6 JavaScript support.
*   **Standard Player:** Works on most browsers with HTML5 audio support.

## Known Issues & Notes

*   The traditional HTTP streaming relies on `app.js`. If this file is missing or not configured, the "Standard Player" might not function as expected when using `npm start` alone. Ensure `app.js` is present and correctly set up if you intend to use the `start:legacy` script.
*   Duration for OGG files (and MP3s where `mp3-duration` fails) is estimated based on filesize and a standard bitrate, which might not always be perfectly accurate.

---

Thank you for using HomeSync Radio! We hope you enjoy the synchronized listening experience.
