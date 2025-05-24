// Import modules
import {
	initWebSocket,
	sendMessage,
	requestTrackList,
	requestPlaybackState,
} from './modules/websocket.js'
import { initUI } from './modules/ui.js'
import { initPlayback } from './modules/playback.js'
import { initTrackList } from './modules/tracks.js'
import { initMessageHandler } from './modules/message-handler.js'

// Shared state
const state = {
	currentTrackId: null,
	trackList: [],
	isPlaying: false,
	currentPosition: 0,
	trackDuration: 0,
	playbackStartTime: null,
	playbackOffset: 0,
	lastServerSync: 0,
	debugLog: [],
}

// Initialize the admin panel
function initAdminPanel() {
	// Initialize UI components
	const ui = initUI()

	// Initialize modules with dependencies
	const ws = initWebSocket(ui, state)
	const playback = initPlayback(state, ui, ws)
	const trackList = initTrackList(state, ui, ws)
	const messageHandler = initMessageHandler(state, ui)

	// Setup event listeners for playback updates
	window.addEventListener('playback-update', (event) => {
		playback.updatePlaybackState(event.detail)
	})

	// Set up periodic updates
	setInterval(() => {
		if (ws && state.isPlaying) {
			// Request playback state and progress from server
			requestPlaybackState()
			sendMessage({ type: 'getProgress' })

			// Check if we need a sync due to long time without server updates
			const now = Date.now() / 1000
			if (state.isPlaying && now - state.lastServerSync > 30) {
				console.log('Forcing progress request due to long time without sync')
				requestPlaybackState()
			}
		}
	}, 5000)
}

// Start the admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', initAdminPanel)
