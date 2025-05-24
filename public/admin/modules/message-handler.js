// WebSocket message handling

/**
 * Initialize message handler for WebSocket messages
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 * @returns {Object} - Message handling methods
 */
export function initMessageHandler(state, ui) {
	// Setup event listener for WebSocket messages
	window.addEventListener('ws-message', (event) => {
		handleMessage(event.detail, state, ui)
	})

	return {
		handleMessage: (data) => handleMessage(data, state, ui),
	}
}

/**
 * Handle messages from the server
 * @param {Object} data - Message data
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 */
function handleMessage(data, state, ui) {
	console.log('Received message:', data)

	// Log for debugging
	state.debugLog.unshift({
		time: new Date().toISOString(),
		type: data.type,
		data: JSON.stringify(data),
	})
	if (state.debugLog.length > 10) state.debugLog.pop()

	try {
		switch (data.type) {
			case 'tracks':
				// Update track list
				console.log('Received tracks data:', data.tracks)
				// Only update if we actually have tracks
				if (data.tracks && data.tracks.length > 0) {
					state.trackList = data.tracks

					// For each track, estimate duration if needed
					state.trackList.forEach((track) => {
						if (!track.duration && track.sizeMB) {
							// Rough estimate: 1MB ≈ 1 minute
							track.duration = track.sizeMB * 60
						}
						console.log(
							`Track ${track.id}: ${track.name}, Duration: ${track.duration}s, Size: ${track.sizeMB}MB`
						)
					})

					// Dispatch event to trigger track list rendering
					window.dispatchEvent(
						new CustomEvent('tracks-loaded', {
							detail: { tracks: state.trackList },
						})
					)
				} else {
					console.log('No tracks found in data or empty tracks array')
				}

				// Update client count if present
				if (data.clients) {
					ui.updateClientCount(data.clients)
				}
				break

			case 'playbackState':
				// Dispatch event to update playback state
				window.dispatchEvent(
					new CustomEvent('playback-update', {
						detail: data,
					})
				)
				break

			case 'clientCount':
				// Update connected client count with detailed breakdown
				ui.updateClientCount(data.clients || { total: data.count })
				break

			case 'progress':
				// Update playback progress
				updatePlaybackProgress(data, state, ui)
				break

			case 'error':
				ui.showNotification(`Error: ${data.message}`)
				break

			case 'initial':
				// Handle initial data from server
				console.log('Initial data received:', data)

				if (data.tracks) {
					state.trackList = data.tracks

					// For each track, estimate duration if needed
					state.trackList.forEach((track) => {
						if (!track.duration && track.sizeMB) {
							// Rough estimate: 1MB ≈ 1 minute
							track.duration = track.sizeMB * 60
						}
					})

					window.dispatchEvent(
						new CustomEvent('tracks-loaded', {
							detail: { tracks: state.trackList },
						})
					)
				}

				// Update playback state
				if (data.trackId !== undefined) {
					state.currentTrackId = data.trackId
					state.isPlaying = data.isPlaying

					// Check for duration info
					if (data.trackDuration) {
						// Convert to seconds if it's in milliseconds
						state.trackDuration =
							data.trackDuration > 10000
								? Math.round(data.trackDuration / 1000)
								: data.trackDuration

						console.log(`Set track duration to ${state.trackDuration} seconds`)
					}

					// Check for position info
					if (data.currentPosition) {
						// Convert to seconds if it's in milliseconds
						state.currentPosition =
							data.currentPosition > 10000
								? Math.round(data.currentPosition / 1000)
								: data.currentPosition
						state.playbackOffset = state.currentPosition

						console.log(
							`Set current position to ${state.currentPosition} seconds`
						)
					}

					// Update track info in UI
					ui.updateTrackInfo(data.trackId, data.trackName, state.trackList)

					// Update playback status
					ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)

					// Update progress display
					if (state.currentPosition !== undefined && state.trackDuration > 0) {
						ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
					}

					// Dispatch playback update event
					window.dispatchEvent(
						new CustomEvent('playback-update', {
							detail: data,
						})
					)
				}

				// Update client count if present
				if (data.clients) {
					ui.updateClientCount(data.clients)
				}
				break

			case 'sync':
				// Handle sync updates
				console.log('Sync data received:', data)

				if (data.trackId !== undefined) {
					const trackChanged = state.currentTrackId !== data.trackId
					state.currentTrackId = data.trackId
					const playStateChanged = state.isPlaying !== data.isPlaying
					state.isPlaying = data.isPlaying

					// Check for duration
					if (data.trackDuration) {
						// Convert to seconds if it's in milliseconds
						state.trackDuration =
							data.trackDuration > 10000
								? Math.round(data.trackDuration / 1000)
								: data.trackDuration

						console.log(
							`Sync: Set track duration to ${state.trackDuration} seconds`
						)
					}

					// Check for position
					if (data.currentPosition) {
						// Convert to seconds if it's in milliseconds
						state.currentPosition =
							data.currentPosition > 10000
								? Math.round(data.currentPosition / 1000)
								: data.currentPosition
						state.playbackOffset = state.currentPosition

						console.log(
							`Sync: Set current position to ${state.currentPosition} seconds`
						)
					}

					// Update track info if changed
					if (trackChanged) {
						ui.updateTrackInfo(data.trackId, data.trackName, state.trackList)
					}

					// Update playback status
					ui.updatePlaybackStatus(state.isPlaying, state.currentTrackId)

					// Update progress display
					if (state.currentPosition !== undefined && state.trackDuration > 0) {
						ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
					}

					// Dispatch playback update event
					window.dispatchEvent(
						new CustomEvent('playback-update', {
							detail: data,
						})
					)
				}
				break

			case 'trackChange':
				// Handle track change notifications
				const prevTrackId = state.currentTrackId
				state.currentTrackId = data.trackId

				// Update track info in UI
				ui.updateTrackInfo(data.trackId, data.trackName, state.trackList)

				// Check for track duration
				if (data.trackDuration) {
					// Convert to seconds if it's in milliseconds
					state.trackDuration =
						data.trackDuration > 10000
							? Math.round(data.trackDuration / 1000)
							: data.trackDuration
					state.currentPosition = 0
					state.playbackOffset = 0

					console.log(
						`Track change: Set duration to ${state.trackDuration} seconds`
					)

					// Update progress display with the new track info
					ui.updateProgressDisplay(state.currentPosition, state.trackDuration)

					window.dispatchEvent(
						new CustomEvent('playback-update', {
							detail: data,
						})
					)
				}
				break

			default:
				console.log('Unknown message type:', data.type)
		}
	} catch (error) {
		console.error('Error processing message:', error)
		ui.showNotification(`Error processing message: ${error.message}`)
	}
}

/**
 * Update playback progress based on server data
 * @param {Object} data - Progress data from server
 * @param {Object} state - Shared application state
 * @param {Object} ui - UI elements and methods
 */
function updatePlaybackProgress(data, state, ui) {
	console.log('Progress update:', data)

	// Convert position and duration from ms to seconds if needed
	const position =
		data.position !== undefined
			? data.position > 10000
				? Math.round(data.position / 1000)
				: data.position
			: undefined

	const duration =
		data.duration !== undefined
			? data.duration > 10000
				? Math.round(data.duration / 1000)
				: data.duration
			: undefined

	if (position !== undefined && duration !== undefined) {
		// Update track duration if provided
		if (duration > 0) {
			state.trackDuration = duration
		}

		// Only update position if it's significantly different from our calculated one
		// or if we're not actively playing (to avoid jumps)
		if (!state.isPlaying || Math.abs(position - state.currentPosition) > 3) {
			state.currentPosition = position
			state.playbackOffset = state.currentPosition
			state.playbackStartTime = Date.now() / 1000
		}

		// Update the display
		ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		state.lastServerSync = Date.now() / 1000
	}
	// If we just have position but no duration
	else if (position !== undefined && state.trackDuration > 0) {
		// Only update position if needed
		if (!state.isPlaying || Math.abs(position - state.currentPosition) > 3) {
			state.currentPosition = position
			state.playbackOffset = state.currentPosition
			state.playbackStartTime = Date.now() / 1000
		}

		// Update with the duration we already know
		ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		state.lastServerSync = Date.now() / 1000
	}
	// If we have neither, but we're supposedly playing something
	else if (
		state.currentTrackId &&
		state.isPlaying &&
		state.trackDuration === 0
	) {
		// Try to find track duration from our track list
		const track = state.trackList.find((t) => t.id === state.currentTrackId)
		if (track && track.duration) {
			state.trackDuration = track.duration
			ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		}
		// If we still don't have duration but have size, estimate it
		else if (track && track.sizeMB) {
			state.trackDuration = track.sizeMB * 60
			ui.updateProgressDisplay(state.currentPosition, state.trackDuration)
		}
	}
}
