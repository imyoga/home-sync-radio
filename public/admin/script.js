// Variables
let socket
let currentTrackId = null
let trackList = []
let isPlaying = false
let currentPosition = 0
let trackDuration = 0
let progressInterval = null
let playbackStartTime = null
let playbackOffset = 0
let lastServerSync = 0
let debugLog = []

// DOM Elements
let statusDot
let statusText
let trackListElement
let playBtn
let pauseBtn
let stopBtn
let nowPlayingElement
let playbackStatusElement
let clientCountElement
let refreshBtn
let notification
let progressBar
let currentTimeElement
let totalTimeElement
let remainingTimeElement
let listenerCount
let adminCount
let unknownInfo

// Initialize WebSocket connection
function connectWebSocket() {
	// Use current hostname to make it work locally or on a server
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const wsUrl = `${protocol}//${window.location.host}`

	statusDot.className = 'status-indicator'
	statusText.textContent = 'Connecting to server...'

	socket = new WebSocket(wsUrl)

	socket.onopen = () => {
		statusDot.className = 'status-indicator connected'
		statusText.textContent = 'Connected to server'

		// Identify as an admin panel
		socket.send(
			JSON.stringify({
				type: 'identify',
				clientType: 'admin',
			})
		)

		// Fetch available tracks
		requestTrackList()

		// Request current playback state
		requestPlaybackState()
	}

	socket.onmessage = (event) => {
		// Check if it's a binary message (audio data)
		if (event.data instanceof Blob) {
			console.log('Binary audio data received (ignored in admin panel)')
			// Admin panel doesn't need to process audio data
			return
		}

		// Handle JSON messages
		try {
			console.log('Raw message received:', event.data)
			const data = JSON.parse(event.data)
			handleMessage(data)
		} catch (e) {
			console.error('Parse error:', e)
			showNotification('Error parsing server message')
		}
	}

	socket.onclose = () => {
		statusDot.className = 'status-indicator'
		statusText.textContent = 'Disconnected from server'

		// Try to reconnect after delay
		setTimeout(connectWebSocket, 5000)
	}

	socket.onerror = (error) => {
		statusText.textContent = 'Connection error'
		showNotification('WebSocket connection error')
	}
}

// Format seconds to MM:SS
function formatTime(seconds) {
	if (isNaN(seconds) || seconds < 0) return '00:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins.toString().padStart(2, '0')}:${secs
		.toString()
		.padStart(2, '0')}`
}

// Update the progress display elements
function updateProgressDisplay() {
	// Update progress bar and time displays
	if (trackDuration > 0) {
		const progressPercent = Math.min(
			100,
			(currentPosition / trackDuration) * 100
		)
		progressBar.style.width = `${progressPercent}%`
		currentTimeElement.textContent = formatTime(currentPosition)
		totalTimeElement.textContent = formatTime(trackDuration)
		remainingTimeElement.textContent = formatTime(
			Math.max(0, trackDuration - currentPosition)
		)
	} else {
		// No duration info
		progressBar.style.width = '0%'
		currentTimeElement.textContent = formatTime(currentPosition)
		totalTimeElement.textContent = '00:00'
		remainingTimeElement.textContent = '00:00'
	}
}

// Update client count information
function updateClientCount(clients) {
	if (!clients) return

	const total = clients.total || 0
	const listeners = clients.listeners || 0
	const admins = clients.admins || 0
	const unknown = total - listeners - admins

	clientCountElement.textContent = total

	if (listenerCount) listenerCount.textContent = listeners
	if (adminCount) adminCount.textContent = admins

	if (unknownInfo && unknown > 0) {
		unknownInfo.textContent = `, ${unknown} unknown`
	} else if (unknownInfo) {
		unknownInfo.textContent = ''
	}
}

// Update playback state UI
function updatePlaybackState(data) {
	console.log('Updating playback state:', data)

	const trackChanged = currentTrackId !== data.trackId
	const playStateChanged = isPlaying !== data.isPlaying

	// Update state variables
	isPlaying = data.isPlaying
	currentTrackId = data.trackId

	// Update UI text
	playbackStatusElement.textContent = isPlaying
		? 'Playing'
		: data.trackId
		? 'Paused'
		: 'Stopped'

	// Update track info if track changed
	if (trackChanged) {
		updateTrackInfo(data.trackId, data.trackName)
	}

	// Update progress information if available
	if (data.trackDuration !== undefined) {
		trackDuration = data.trackDuration
	} else if (data.duration !== undefined) {
		trackDuration = data.duration
	}

	if (data.currentPosition !== undefined) {
		currentPosition = data.currentPosition / 1000 // Convert ms to seconds if needed
		playbackOffset = currentPosition
	} else if (data.position !== undefined) {
		currentPosition = data.position
		playbackOffset = currentPosition
	}

	if (trackDuration > 0 || currentPosition > 0) {
		playbackStartTime = Date.now() / 1000
		updateProgressDisplay()
		lastServerSync = Date.now() / 1000
	}

	// Handle playback tracking state changes
	if (playStateChanged) {
		if (isPlaying) {
			playbackOffset = currentPosition
			playbackStartTime = Date.now() / 1000
			startProgressTracking()
		} else {
			stopProgressTracking()
		}
	}

	// Update client count if present
	if (data.clients) {
		updateClientCount(data.clients)
	}
}

// Handle server messages
function handleMessage(data) {
	console.log('Received message:', data)

	// Log for debugging
	debugLog.unshift({
		time: new Date().toISOString(),
		type: data.type,
		data: JSON.stringify(data),
	})
	if (debugLog.length > 10) debugLog.pop()

	try {
		switch (data.type) {
			case 'tracks':
				// Update track list
				trackList = data.tracks

				// For each track, estimate duration if needed
				trackList.forEach((track) => {
					if (!track.duration && track.sizeMB) {
						// Rough estimate: 1MB ≈ 1 minute (adjust based on your audio quality)
						track.duration = track.sizeMB * 60
					}
				})

				renderTrackList()

				// Update client count if present
				if (data.clients) {
					updateClientCount(data.clients)
				}
				break

			case 'playbackState':
				// Update playback state
				updatePlaybackState(data)
				break

			case 'clientCount':
				// Update connected client count with detailed breakdown
				updateClientCount(data.clients || { total: data.count })
				break

			case 'progress':
				// Update playback progress
				updatePlaybackProgress(data)
				break

			case 'error':
				showNotification(`Error: ${data.message}`)
				break

			case 'initial':
				// Handle initial data from server
				console.log('Initial data received:', data)

				if (data.tracks) {
					trackList = data.tracks

					// For each track, estimate duration if needed
					trackList.forEach((track) => {
						if (!track.duration && track.sizeMB) {
							// Rough estimate: 1MB ≈ 1 minute
							track.duration = track.sizeMB * 60
						}
					})

					renderTrackList()
				}

				// Update playback state
				if (data.trackId !== undefined) {
					currentTrackId = data.trackId
					isPlaying = data.isPlaying

					// Check for duration info
					if (data.trackDuration) {
						trackDuration = data.trackDuration
					}

					// Check for position info
					if (data.currentPosition) {
						currentPosition = data.currentPosition / 1000 // Convert ms to seconds if needed
						playbackOffset = currentPosition
					}

					// Update track info in UI
					updateTrackInfo(data.trackId, data.trackName)

					// Update playback status
					playbackStatusElement.textContent = isPlaying
						? 'Playing'
						: data.trackId
						? 'Paused'
						: 'Stopped'

					// Handle playback tracking
					if (isPlaying) {
						playbackStartTime = Date.now() / 1000
						updateProgressDisplay()
						startProgressTracking()
					}
				}

				// Update client count if present
				if (data.clients) {
					updateClientCount(data.clients)
				}
				break

			case 'sync':
				// Handle sync updates
				console.log('Sync data received:', data)

				if (data.trackId !== undefined) {
					const trackChanged = currentTrackId !== data.trackId
					currentTrackId = data.trackId
					const playStateChanged = isPlaying !== data.isPlaying
					isPlaying = data.isPlaying

					// Check for duration
					if (data.trackDuration) {
						trackDuration = data.trackDuration
					}

					// Check for position
					if (data.currentPosition) {
						currentPosition = data.currentPosition / 1000 // Convert ms to seconds if needed
						playbackOffset = currentPosition
					}

					// Update track info if changed
					if (trackChanged) {
						updateTrackInfo(data.trackId, data.trackName)
					}

					// Update playback status
					playbackStatusElement.textContent = isPlaying
						? 'Playing'
						: data.trackId
						? 'Paused'
						: 'Stopped'

					// Handle playback tracking state changes
					if (trackDuration > 0) {
						updateProgressDisplay()

						if (playStateChanged) {
							if (isPlaying) {
								playbackOffset = currentPosition
								playbackStartTime = Date.now() / 1000
								startProgressTracking()
							} else {
								stopProgressTracking()
							}
						}
					}

					// Update client count if present
					if (data.clients) {
						updateClientCount(data.clients)
					}
				}
				break

			case 'trackChange':
				// Handle track change notifications
				const prevTrackId = currentTrackId
				currentTrackId = data.trackId

				// Update track info in UI
				updateTrackInfo(data.trackId, data.trackName)

				// Check for track duration
				if (data.trackDuration) {
					trackDuration = data.trackDuration
					currentPosition = 0
					playbackOffset = 0

					if (isPlaying) {
						playbackStartTime = Date.now() / 1000
						updateProgressDisplay()
						startProgressTracking()
					}
				}
				break

			default:
				console.log('Unknown message type:', data.type)
		}
	} catch (error) {
		console.error('Error processing message:', error)
		showNotification(`Error processing message: ${error.message}`)
	}
}

// Update track info in the UI
function updateTrackInfo(trackId, trackName) {
	if (trackId) {
		// If we have a direct track name provided, use it
		if (trackName) {
			nowPlayingElement.textContent = trackName
		} else {
			// Otherwise look it up in our track list
			const track = trackList.find((t) => t.id === trackId)
			if (track) {
				nowPlayingElement.textContent = track.name

				// If the track has duration info and we don't, use it
				if (track.duration && trackDuration === 0) {
					trackDuration = track.duration
					totalTimeElement.textContent = formatTime(trackDuration)

					// If we're playing, start progress tracking with this new duration
					if (isPlaying) {
						startProgressTracking()
					}
				}

				// If we still don't have duration, but have size, estimate it
				if (trackDuration === 0 && track.sizeMB) {
					// Rough estimate: 1MB ≈ 1 minute (adjust based on your audio quality)
					trackDuration = track.sizeMB * 60
					totalTimeElement.textContent = formatTime(trackDuration)
					remainingTimeElement.textContent = formatTime(
						trackDuration - currentPosition
					)

					// If we're playing, start progress tracking with this new duration
					if (isPlaying) {
						startProgressTracking()
					}
				}
			} else {
				nowPlayingElement.textContent = `Track ID: ${trackId}`
			}
		}
	} else {
		nowPlayingElement.textContent = 'None'
		// Reset progress when no track
		currentPosition = 0
		trackDuration = 0
		updateProgressDisplay()
	}

	// Update track list selection
	renderTrackList()
}

// Update playback progress based on server data
function updatePlaybackProgress(data) {
	console.log('Progress update:', data)

	if (data.position !== undefined && data.duration !== undefined) {
		// Update track duration if provided
		if (data.duration > 0) {
			trackDuration = data.duration
		}

		// Only update position if it's significantly different from our calculated one
		// or if we're not actively playing (to avoid jumps)
		if (!isPlaying || Math.abs(data.position - currentPosition) > 3) {
			currentPosition = data.position
			playbackOffset = currentPosition
			playbackStartTime = Date.now() / 1000
		}

		// Update the display
		updateProgressDisplay()
		lastServerSync = Date.now() / 1000
	}
	// If we just have position but no duration
	else if (data.position !== undefined && trackDuration > 0) {
		// Only update position if needed
		if (!isPlaying || Math.abs(data.position - currentPosition) > 3) {
			currentPosition = data.position
			playbackOffset = currentPosition
			playbackStartTime = Date.now() / 1000
		}

		// Update with the duration we already know
		updateProgressDisplay()
		lastServerSync = Date.now() / 1000
	}
	// If we have neither, but we're supposedly playing something
	else if (currentTrackId && isPlaying && trackDuration === 0) {
		// Try to find track duration from our track list
		const track = trackList.find((t) => t.id === currentTrackId)
		if (track && track.duration) {
			trackDuration = track.duration
			updateProgressDisplay()
		}
		// If we still don't have duration but have size, estimate it
		else if (track && track.sizeMB) {
			trackDuration = track.sizeMB * 60
			updateProgressDisplay()
		}
	}
}

// Start accurate progress tracking
function startProgressTracking() {
	// Clear any existing interval
	stopProgressTracking()

	// Don't start if no duration
	if (trackDuration <= 0) {
		// Try to get duration from track list
		if (currentTrackId) {
			const track = trackList.find((t) => t.id === currentTrackId)
			if (track && track.duration) {
				trackDuration = track.duration
			}
			// If we still don't have duration but have size, estimate it
			else if (track && track.sizeMB) {
				trackDuration = track.sizeMB * 60
			}
		}

		// If still no duration, don't start tracking
		if (trackDuration <= 0) {
			console.log("Can't start progress tracking: no duration")
			return
		}
	}

	console.log(
		'Starting progress tracking with duration:',
		trackDuration,
		'current position:',
		currentPosition
	)

	// Set the start time if not already set
	if (!playbackStartTime) {
		playbackStartTime = Date.now() / 1000
	}

	// Start the interval
	progressInterval = setInterval(() => {
		if (isPlaying && trackDuration > 0) {
			// Calculate elapsed time since playback started
			const now = Date.now() / 1000
			const elapsed = now - playbackStartTime

			// Calculate current position
			currentPosition = playbackOffset + elapsed

			// Check if we've reached the end
			if (currentPosition >= trackDuration) {
				currentPosition = trackDuration
				updateProgressDisplay()

				// The server should tell us about track completion,
				// but as a backup, we'll request state after reaching the end
				requestPlaybackState()
				return
			}

			// Update the display
			updateProgressDisplay()
		}
	}, 200) // Update 5 times per second for smoother progress
}

// Stop progress tracking
function stopProgressTracking() {
	if (progressInterval) {
		clearInterval(progressInterval)
		progressInterval = null
	}
}

// Render the track list
function renderTrackList() {
	trackListElement.innerHTML = ''

	if (trackList.length === 0) {
		trackListElement.innerHTML =
			'<div class="loading">No tracks available</div>'
		return
	}

	trackList.forEach((track) => {
		const trackElement = document.createElement('div')
		trackElement.className = 'track-item'
		if (track.id === currentTrackId) {
			trackElement.classList.add('active')
		}

		const sizeMB = track.sizeMB || 'Unknown'
		const duration = track.duration ? formatTime(track.duration) : ''

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
			selectTrack(track.id)
		})

		trackListElement.appendChild(trackElement)
	})
}

// Select a track
function selectTrack(trackId) {
	if (socket && socket.readyState === WebSocket.OPEN) {
		// Try WebSocket first
		socket.send(
			JSON.stringify({
				type: 'selectTrack',
				trackId: trackId,
			})
		)

		// Also try the HTTP API as a fallback
		fetch('/api/control/select', {
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
					currentTrackId = trackId
					renderTrackList()

					// Find track name for display
					const track = trackList.find((t) => t.id === trackId)
					if (track) {
						nowPlayingElement.textContent = track.name
					}
				}
			})
			.catch((err) => {
				console.error('Error selecting track via API:', err)
				showNotification('Error selecting track')
			})
	}
}

// Show notification
function showNotification(message) {
	notification.textContent = message
	notification.classList.add('show')

	setTimeout(() => {
		notification.classList.remove('show')
	}, 3000)
}

// Request the list of available tracks
function requestTrackList() {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'getTrackList' }))

		// As a fallback, also try to get tracks via HTTP API
		fetch('/api/tracks')
			.then((response) => response.json())
			.then((data) => {
				if (data && data.tracks && data.tracks.length > 0) {
					trackList = data.tracks
					renderTrackList()
				}
			})
			.catch((err) => {
				console.error('Error fetching tracks via API:', err)
			})
	}
}

// Request current playback state
function requestPlaybackState() {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'getPlaybackState' }))
	}
}

// Play the currently selected track
function playTrack() {
	if (socket && socket.readyState === WebSocket.OPEN) {
		// Try WebSocket
		socket.send(JSON.stringify({ type: 'play' }))

		// Also try HTTP API
		fetch('/api/control/play', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		}).catch((err) => {
			console.error('Error playing track via API:', err)
			showNotification('Error playing track')
		})

		// Optimistically update UI
		isPlaying = true
		playbackStatusElement.textContent = 'Playing'
		playbackOffset = currentPosition
		playbackStartTime = Date.now() / 1000
		startProgressTracking()
	}
}

// Pause playback
function pauseTrack() {
	if (socket && socket.readyState === WebSocket.OPEN) {
		// Try WebSocket
		socket.send(JSON.stringify({ type: 'pause' }))

		// Also try HTTP API
		fetch('/api/control/pause', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		}).catch((err) => {
			console.error('Error pausing track via API:', err)
			showNotification('Error pausing track')
		})

		// Optimistically update UI
		isPlaying = false
		playbackStatusElement.textContent = 'Paused'
		stopProgressTracking()
	}
}

// Stop playback
function stopTrack() {
	if (socket && socket.readyState === WebSocket.OPEN) {
		// Try WebSocket
		socket.send(JSON.stringify({ type: 'stop' }))

		// Also try HTTP API
		fetch('/api/control/stop', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		}).catch((err) => {
			console.error('Error stopping track via API:', err)
			showNotification('Error stopping track')
		})

		// Optimistically update UI
		isPlaying = false
		playbackStatusElement.textContent = 'Stopped'
		currentPosition = 0
		playbackOffset = 0
		updateProgressDisplay()
		stopProgressTracking()
	}
}

// Initialize the admin panel
function initAdminPanel() {
	// Get DOM elements
	statusDot = document.getElementById('statusDot')
	statusText = document.getElementById('statusText')
	trackListElement = document.getElementById('trackList')
	playBtn = document.getElementById('playBtn')
	pauseBtn = document.getElementById('pauseBtn')
	stopBtn = document.getElementById('stopBtn')
	nowPlayingElement = document.getElementById('nowPlaying')
	playbackStatusElement = document.getElementById('playbackStatus')
	clientCountElement = document.getElementById('clientCount')
	listenerCount = document.getElementById('listenerCount')
	adminCount = document.getElementById('adminCount')
	unknownInfo = document.getElementById('unknownInfo')
	refreshBtn = document.getElementById('refreshBtn')
	notification = document.getElementById('notification')
	progressBar = document.getElementById('progressBar')
	currentTimeElement = document.getElementById('currentTime')
	totalTimeElement = document.getElementById('totalTime')
	remainingTimeElement = document.getElementById('remainingTime')

	// Connect to WebSocket server
	connectWebSocket()

	// Set up event listeners
	playBtn.addEventListener('click', playTrack)
	pauseBtn.addEventListener('click', pauseTrack)
	stopBtn.addEventListener('click', stopTrack)
	refreshBtn.addEventListener('click', requestTrackList)

	// Request updates periodically
	setInterval(() => {
		if (socket && socket.readyState === WebSocket.OPEN) {
			// Request playback state from server
			requestPlaybackState()

			// Also request progress information
			socket.send(JSON.stringify({ type: 'getProgress' }))

			// Check if we haven't had a sync in a while and our tracking might be off
			const now = Date.now() / 1000
			if (isPlaying && now - lastServerSync > 30) {
				// Force a progress request if we haven't heard from the server in 30 seconds
				console.log('Forcing progress request due to long time without sync')
				requestPlaybackState()
			}
		}
	}, 5000)
}

// Start the admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', initAdminPanel)
