// Playback control and progress tracking
let progressInterval = null

/**
 * Initialize playback controls and tracking
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @param {Object} ws - WebSocket methods
 * @returns {Object} - Playback control methods
 */
export function initPlayback(state, ui, ws) {
	// Setup control button event listeners
	ui.elements.playBtn.addEventListener('click', () => playTrack(state, ui, ws))
	ui.elements.pauseBtn.addEventListener('click', () =>
		pauseTrack(state, ui, ws)
	)
	ui.elements.stopBtn.addEventListener('click', () => stopTrack(state, ui, ws))

	return {
		playTrack: () => playTrack(state, ui, ws),
		pauseTrack: () => pauseTrack(state, ui, ws),
		stopTrack: () => stopTrack(state, ui, ws),
		startProgressTracking: () => startProgressTracking(state, ui),
		stopProgressTracking,
		updatePlaybackState: (data) => updatePlaybackState(data, state, ui),
	}
}

/**
 * Update playback state based on server data
 * @param {Object} data - Playback state data
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 */
export function updatePlaybackState(data, state, ui) {
	console.log('Updating playback state:', data)

	const trackChanged = state.currentTrackId !== data.trackId
	const playStateChanged = state.isPlaying !== data.isPlaying

	// Update state variables
	state.isPlaying = data.isPlaying
	state.currentTrackId = data.trackId

	// Update UI text
	ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)

	// Update track info if track changed
	if (trackChanged) {
		ui.updateTrackInfo(data.trackId, data.trackName, state.trackList)
	}

	// Update progress information if available
	if (data.trackDuration !== undefined) {
		// Convert ms to seconds if needed
		state.trackDuration =
			data.trackDuration > 10000
				? Math.round(data.trackDuration / 1000)
				: data.trackDuration
	} else if (data.duration !== undefined) {
		// Convert ms to seconds if needed
		state.trackDuration =
			data.duration > 10000 ? Math.round(data.duration / 1000) : data.duration
	}

	if (data.currentPosition !== undefined) {
		// Convert ms to seconds if needed
		state.currentPosition =
			data.currentPosition > 10000
				? Math.round(data.currentPosition / 1000)
				: data.currentPosition
		state.playbackOffset = state.currentPosition
	} else if (data.position !== undefined) {
		// Convert ms to seconds if needed
		state.currentPosition =
			data.position > 10000 ? Math.round(data.position / 1000) : data.position
		state.playbackOffset = state.currentPosition
	}

	if (state.trackDuration > 0 || state.currentPosition > 0) {
		state.playbackStartTime = Date.now() / 1000
		ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		state.lastServerSync = Date.now() / 1000
	}

	// Handle playback tracking state changes
	if (playStateChanged) {
		if (state.isPlaying) {
			state.playbackOffset = state.currentPosition
			state.playbackStartTime = Date.now() / 1000
			startProgressTracking(state, ui)
		} else {
			stopProgressTracking()
		}
	}

	// Update client count if present
	if (data.clients) {
		ui.updateClientCount(data.clients)
	}
}

/**
 * Start accurate progress tracking
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 */
function startProgressTracking(state, ui) {
	// Clear any existing interval
	stopProgressTracking()

	// Don't start if no duration
	if (state.trackDuration <= 0) {
		// Try to get duration from track list
		if (state.currentTrackId) {
			const track = state.trackList.find((t) => t.id === state.currentTrackId)
			if (track && track.duration) {
				state.trackDuration = track.duration
			}
			// If we still don't have duration but have size, estimate it
			else if (track && track.sizeMB) {
				state.trackDuration = track.sizeMB * 60
			}
		}

		// If still no duration, don't start tracking
		if (state.trackDuration <= 0) {
			console.log("Can't start progress tracking: no duration")
			return
		}
	}

	console.log(
		'Starting progress tracking with duration:',
		state.trackDuration,
		'current position:',
		state.currentPosition
	)

	// Set the start time if not already set
	if (!state.playbackStartTime) {
		state.playbackStartTime = Date.now() / 1000
	}

	// Start the interval
	progressInterval = setInterval(() => {
		if (state.isPlaying && state.trackDuration > 0) {
			// Calculate elapsed time since playback started
			const now = Date.now() / 1000
			const elapsed = now - state.playbackStartTime

			// Calculate current position
			state.currentPosition = state.playbackOffset + elapsed

			// Check if we've reached the end
			if (state.currentPosition >= state.trackDuration) {
				state.currentPosition = state.trackDuration
				ui.updateProgressDisplay(state.currentPosition, state.trackDuration)

				// The server should tell us about track completion,
				// but as a backup, we'll request state
				stopProgressTracking()
				return
			}

			// Update the display
			ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		}
	}, 200) // Update 5 times per second for smoother progress
}

/**
 * Stop progress tracking
 */
function stopProgressTracking() {
	if (progressInterval) {
		clearInterval(progressInterval)
		progressInterval = null
	}
}

/**
 * Play the current track
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @param {Object} ws - WebSocket methods
 */
function playTrack(state, ui, ws) {
	if (!ws) return

	// Try WebSocket
	ws.sendMessage({ type: 'play' })

	// Also try HTTP API
	fetch('/api/control/play', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({}),
	}).catch((err) => {
		console.error('Error playing track via API:', err)
		ui.showNotification('Error playing track')
	})

	// Optimistically update UI
	state.isPlaying = true
	ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)
	state.playbackOffset = state.currentPosition
	state.playbackStartTime = Date.now() / 1000
	startProgressTracking(state, ui)
}

/**
 * Pause playback
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @param {Object} ws - WebSocket methods
 */
function pauseTrack(state, ui, ws) {
	if (!ws) return

	// Try WebSocket
	ws.sendMessage({ type: 'pause' })

	// Also try HTTP API
	fetch('/api/control/pause', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({}),
	}).catch((err) => {
		console.error('Error pausing track via API:', err)
		ui.showNotification('Error pausing track')
	})

	// Optimistically update UI
	state.isPlaying = false
	ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)
	stopProgressTracking()
}

/**
 * Stop playback
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @param {Object} ws - WebSocket methods
 */
function stopTrack(state, ui, ws) {
	if (!ws) return

	// Try WebSocket
	ws.sendMessage({ type: 'stop' })

	// Also try HTTP API
	fetch('/api/control/stop', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({}),
	}).catch((err) => {
		console.error('Error stopping track via API:', err)
		ui.showNotification('Error stopping track')
	})

	// Optimistically update UI
	state.isPlaying = false
	ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)
	state.currentPosition = 0
	state.playbackOffset = 0
	ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
	stopProgressTracking()
}
