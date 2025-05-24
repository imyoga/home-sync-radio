// UI elements and utility functions
let elements = {}

/**
 * Initialize UI elements and handlers
 * @returns {Object} - UI methods and elements
 */
export function initUI() {
	// Get DOM elements
	elements = {
		statusDot: document.getElementById('statusDot'),
		statusText: document.getElementById('statusText'),
		trackListElement: document.getElementById('trackList'),
		playBtn: document.getElementById('playBtn'),
		pauseBtn: document.getElementById('pauseBtn'),
		stopBtn: document.getElementById('stopBtn'),
		nowPlayingElement: document.getElementById('nowPlaying'),
		playbackStatusElement: document.getElementById('playbackStatus'),
		clientCountElement: document.getElementById('clientCount'),
		listenerCount: document.getElementById('listenerCount'),
		adminCount: document.getElementById('adminCount'),
		unknownInfo: document.getElementById('unknownInfo'),
		refreshBtn: document.getElementById('refreshBtn'),
		notification: document.getElementById('notification'),
		progressBar: document.getElementById('progressBar'),
		currentTimeElement: document.getElementById('currentTime'),
		totalTimeElement: document.getElementById('totalTime'),
		remainingTimeElement: document.getElementById('remainingTime'),
	}

	return {
		elements,
		updateConnectionStatus,
		updatePlaybackStatus,
		updateTrackInfo,
		updateClientCount,
		updateProgressDisplay,
		showNotification,
		formatTime,
	}
}

/**
 * Update connection status indicator
 * @param {string} status - Connection status ('connecting', 'connected', 'disconnected', 'error')
 */
export function updateConnectionStatus(status) {
	switch (status) {
		case 'connecting':
			elements.statusDot.className = 'status-indicator'
			elements.statusText.textContent = 'Connecting to server...'
			break
		case 'connected':
			elements.statusDot.className = 'status-indicator connected'
			elements.statusText.textContent = 'Connected to server'
			break
		case 'disconnected':
			elements.statusDot.className = 'status-indicator'
			elements.statusText.textContent = 'Disconnected from server'
			break
		case 'error':
			elements.statusDot.className = 'status-indicator'
			elements.statusText.textContent = 'Connection error'
			break
	}
}

/**
 * Update playback status text
 * @param {boolean} isPlaying - Whether audio is currently playing
 * @param {string|null} trackId - Current track ID or null if no track
 */
export function updatePlaybackStatus(isPlaying, trackId) {
	elements.playbackStatusElement.textContent = isPlaying
		? 'Playing'
		: trackId
		? 'Paused'
		: 'Stopped'
}

/**
 * Update track information in UI
 * @param {string|null} trackId - Track ID
 * @param {string|null} trackName - Track name (optional)
 * @param {Array} trackList - List of available tracks
 */
export function updateTrackInfo(trackId, trackName, trackList) {
	if (trackId) {
		// If we have a direct track name provided, use it
		if (trackName) {
			elements.nowPlayingElement.textContent = trackName
		} else {
			// Otherwise look it up in our track list
			const track = trackList.find((t) => t.id === trackId)
			if (track) {
				elements.nowPlayingElement.textContent = track.name
			} else {
				elements.nowPlayingElement.textContent = `Track ID: ${trackId}`
			}
		}
	} else {
		elements.nowPlayingElement.textContent = 'None'
	}

	// Always log what we're displaying for debugging
	console.log(
		`Updated track info: ${elements.nowPlayingElement.textContent} (ID: ${
			trackId || 'none'
		})`
	)
}

/**
 * Update client count information
 * @param {Object} clients - Client counts object
 */
export function updateClientCount(clients) {
	if (!clients) return

	const total = clients.total || 0
	const listeners = clients.listeners || 0
	const admins = clients.admins || 0
	const unknown = total - listeners - admins

	elements.clientCountElement.textContent = total

	if (elements.listenerCount) elements.listenerCount.textContent = listeners
	if (elements.adminCount) elements.adminCount.textContent = admins

	if (elements.unknownInfo && unknown > 0) {
		elements.unknownInfo.textContent = `, ${unknown} unknown`
	} else if (elements.unknownInfo) {
		elements.unknownInfo.textContent = ''
	}
}

/**
 * Update progress display elements
 * @param {number} currentPosition - Current playback position in seconds
 * @param {number} trackDuration - Track duration in seconds
 */
export function updateProgressDisplay(currentPosition, trackDuration) {
	// Update progress bar and time displays
	if (trackDuration > 0) {
		const progressPercent = Math.min(
			100,
			(currentPosition / trackDuration) * 100
		)
		elements.progressBar.style.width = `${progressPercent}%`
		elements.currentTimeElement.textContent = formatTime(currentPosition)
		elements.totalTimeElement.textContent = formatTime(trackDuration)
		elements.remainingTimeElement.textContent = formatTime(
			Math.max(0, trackDuration - currentPosition)
		)
	} else {
		// No duration info
		elements.progressBar.style.width = '0%'
		elements.currentTimeElement.textContent = formatTime(currentPosition)
		elements.totalTimeElement.textContent = '00:00'
		elements.remainingTimeElement.textContent = '00:00'
	}
}

/**
 * Show notification message
 * @param {string} message - Message to display
 */
export function showNotification(message) {
	elements.notification.textContent = message
	elements.notification.classList.add('show')

	setTimeout(() => {
		elements.notification.classList.remove('show')
	}, 3000)
}

/**
 * Format seconds to MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export function formatTime(seconds) {
	if (isNaN(seconds) || seconds < 0) return '00:00'

	// Ensure seconds is a number and not a string
	seconds = Number(seconds)

	// Calculate minutes and seconds
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)

	// Format with padding
	return `${mins.toString().padStart(2, '0')}:${secs
		.toString()
		.padStart(2, '0')}`
}
