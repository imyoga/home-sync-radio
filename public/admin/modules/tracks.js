// Track list handling
// Store module-level references
let wsRef
let stateRef
let uiRef

/**
 * Initialize track list functionality
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @param {Object} ws - WebSocket methods
 * @returns {Object} - Track list methods
 */
export function initTrackList(state, ui, ws) {
	// Store references for use throughout the module
	wsRef = ws
	stateRef = state
	uiRef = ui

	// Set up refresh button
	ui.elements.refreshBtn.addEventListener('click', () => {
		ws.requestTrackList()
	})

	// Setup event listeners for incoming track data
	window.addEventListener('tracks-loaded', (event) => {
		updateTrackList(event.detail.tracks, state, ui)
	})

	return {
		renderTrackList: () => renderTrackList(state, ui),
		updateTrackList: (tracks) => updateTrackList(tracks, state, ui),
		selectTrack: (trackId) => selectTrack(trackId, state, ui, ws),
	}
}

/**
 * Update the track list in state
 * @param {Array} tracks - Array of track objects
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 */
function updateTrackList(tracks, state, ui) {
	if (!tracks || !Array.isArray(tracks)) return

	state.trackList = tracks

	// For each track, estimate duration if needed
	state.trackList.forEach((track) => {
		if (!track.duration && track.sizeMB) {
			// Rough estimate: 1MB ≈ 1 minute (adjust based on audio quality)
			track.duration = track.sizeMB * 60
		}
	})

	renderTrackList(state, ui)
}

/**
 * Render the track list in the UI
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 */
function renderTrackList(state, ui) {
	const trackListElement = ui.elements.trackListElement
	trackListElement.innerHTML = ''

	if (state.trackList.length === 0) {
		trackListElement.innerHTML =
			'<div class="loading">No tracks available</div>'
		return
	}

	state.trackList.forEach((track) => {
		const trackElement = document.createElement('div')
		trackElement.className = 'track-item'
		if (track.id === state.currentTrackId) {
			trackElement.classList.add('active')
		}

		const sizeMB = track.sizeMB || 'Unknown'
		const duration = track.duration ? ui.formatTime(track.duration) : ''

		trackElement.innerHTML = `
            <div>
                <div class="track-name">${track.name}</div>
                <div class="track-info">
                    ${duration ? `Duration: ${duration}` : ''}
                    ${sizeMB !== 'Unknown' ? `${sizeMB} MB` : ''}
                </div>
            </div>
        `

		trackElement.addEventListener('click', () => {
			// Use the module-level reference to ws instead of undefined ws
			selectTrack(track.id, state, ui, wsRef)
		})

		trackListElement.appendChild(trackElement)
	})
}

/**
 * Select a track for playback
 * @param {string} trackId - ID of the track to select
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @param {Object} ws - WebSocket methods
 */
function selectTrack(trackId, state, ui, ws) {
	if (!ws) return

	// Try WebSocket first
	ws.sendMessage({
		type: 'selectTrack',
		trackId: trackId,
	})

	// Also try the HTTP API as a fallback
	fetch('/api/radio/control/select', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ trackId: trackId }),
	})
		.then((response) => response.json())
		.then((data) => {
			if (data.success) {
				// Update UI if successful
				state.currentTrackId = trackId
				renderTrackList(state, ui)

				// Find track name for display
				const track = state.trackList.find((t) => t.id === trackId)
				if (track) {
					ui.updateTrackInfo(trackId, track.name, state.trackList)
				}
			}
		})
		.catch((err) => {
			// console.error('Error selecting track via API:', err)
			ui.showNotification('Error selecting track')
		})
}
