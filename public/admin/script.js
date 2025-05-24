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

		// Check if UI and state are out of sync and need correction
		verifyUIState(ui, state)
	}, 5000)

	// Initial verify after a short delay to ensure everything is loaded
	setTimeout(() => verifyUIState(ui, state), 3000)
}

/**
 * Verify UI state matches application state and correct if needed
 * @param {Object} ui - UI functions and elements
 * @param {Object} state - Application state object
 */
function verifyUIState(ui, state) {
	// Verify Now Playing display
	const nowPlayingElement = ui.elements?.nowPlayingElement
	if (
		nowPlayingElement &&
		nowPlayingElement.textContent === 'None' &&
		state.currentTrackId
	) {
		console.log('Fixing inconsistent Now Playing display')

		// Find track info
		const track = state.trackList.find((t) => t.id === state.currentTrackId)
		const trackName = track ? track.name : `Track ID: ${state.currentTrackId}`

		// Update track info display
		ui.updateTrackInfo(state.currentTrackId, trackName, state.trackList)
		ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)

		// Update progress if we have it
		if (state.currentPosition !== undefined && state.trackDuration > 0) {
			ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		}
	}
}

// Start the admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', initAdminPanel)
