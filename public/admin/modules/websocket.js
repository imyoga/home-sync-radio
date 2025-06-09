// WebSocket connection handling
export let socket

/**
 * Initialize WebSocket connection
 * @param {Object} ui - UI elements and methods
 * @param {Object} state - Shared application state
 * @returns {Object} - WebSocket methods
 */
export function initWebSocket(ui, state) {
	// Use current hostname to make it work locally or on a server
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const wsUrl = `${protocol}//${window.location.host}`

	ui.updateConnectionStatus('connecting')

	socket = new WebSocket(wsUrl)

	socket.onopen = () => {
		ui.updateConnectionStatus('connected')

		// Identify as an admin panel
		sendMessage({
			type: 'identify',
			clientType: 'admin',
		})

		// Fetch available tracks
		requestTrackList()

		// Request current playback state
		requestPlaybackState()
	}

	socket.onmessage = (event) => {
		// Check if it's a binary message (audio data)
		if (event.data instanceof Blob) {
			// console.log('Binary audio data received (ignored in admin panel)')
			// Admin panel doesn't need to process audio data
			return
		}

		// Handle JSON messages
		try {
			// console.log('Raw message received:', event.data)
			const data = JSON.parse(event.data)

			// Special logging for playback state and sync messages
			// if (
			// 	data.type === 'playbackState' ||
			// 	data.type === 'sync' ||
			// 	data.type === 'initial'
			// ) {
			// 	console.log(`${data.type} message details:`, {
			// 		trackId: data.trackId,
			// 		trackName: data.trackName,
			// 		isPlaying: data.isPlaying,
			// 		position: data.currentPosition || data.position,
			// 		duration: data.trackDuration || data.duration,
			// 	})
			// }

			// Dispatch to message handler (imported in main.js)
			window.dispatchEvent(new CustomEvent('ws-message', { detail: data }))
		} catch (e) {
			// console.error('Parse error:', e)
			ui.showNotification('Error parsing server message')
		}
	}

	socket.onclose = () => {
		ui.updateConnectionStatus('disconnected')

		// Try to reconnect after delay
		setTimeout(() => initWebSocket(ui, state), 5000)
	}

	socket.onerror = (error) => {
		ui.updateConnectionStatus('error')
		ui.showNotification('WebSocket connection error')
	}

	return {
		sendMessage,
		requestTrackList,
		requestPlaybackState,
	}
}

/**
 * Send a message to the server
 * @param {Object} message - Message object to send
 */
export function sendMessage(message) {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(message))
	}
}

/**
 * Request the list of available tracks
 */
export function requestTrackList() {
	sendMessage({ type: 'getTrackList' })

	// As a fallback, also try to get tracks via HTTP API
	fetch('/api/tracks')
		.then((response) => response.json())
		.then((data) => {
			if (data && data.tracks && data.tracks.length > 0) {
				window.dispatchEvent(
					new CustomEvent('tracks-loaded', {
						detail: { tracks: data.tracks },
					})
				)
			}
		})
		.catch((err) => {
			// console.error('Error fetching tracks via API:', err)
		})
}

/**
 * Request current playback state
 */
export function requestPlaybackState() {
	sendMessage({ type: 'getPlaybackState' })
}
