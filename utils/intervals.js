const radioStateService = require('../services/radioStateService')
const websocketService = require('../services/websocketService')
const { SYNC_BROADCAST_INTERVAL, STATUS_LOG_INTERVAL } = require('../config/constants')

// Console logging every second
function startStatusLogging() {
	setInterval(() => {
		const trackChanged = radioStateService.checkTrackChange() // Check if we need to change tracks
		if (trackChanged) {
			websocketService.broadcastTrackChange()
		}

		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		const clientStats = websocketService.getClientStats()

		if (currentTrack) {
			// Calculate current position
			let currentTime
			if (state.isPlaying) {
				currentTime = (Date.now() - state.startTime) % currentTrack.estimatedDurationMs
			} else {
				currentTime = state.pausedPosition // Use the saved position when paused
			}

			const totalTime = currentTrack.estimatedDurationMs
			const progress = ((currentTime / totalTime) * 100).toFixed(1)

			const status = state.isPlaying ? '▶️ PLAYING' : '⏸️ PAUSED'
			const timeDisplay = `${radioStateService.formatTime(currentTime)}/${radioStateService.formatTime(totalTime)}`
			const trackInfo = `[${state.currentTrackIndex + 1}/${require('../services/musicService').getTrackCount()}] ${currentTrack.name}`
			const unknownText = clientStats.unknown > 0 ? `, ❓ ${clientStats.unknown} unknown` : ''
			const clientInfo = `👥 ${clientStats.total} clients (👂 ${clientStats.listeners} listeners, 🛠️ ${clientStats.admins} admins${unknownText})`

			console.log(
				`📻 ${status} | ${trackInfo} | ${timeDisplay} (${progress}%) | ${clientInfo}`
			)
		} else {
			const unknownText = clientStats.unknown > 0 ? `, ❓ ${clientStats.unknown} unknown` : ''
			console.log(
				`📻 ${state.isPlaying ? '▶️' : '⏸️'} NO TRACK LOADED | 👥 ${
					clientStats.total
				} clients (👂 ${clientStats.listeners} listeners, 🛠️ ${clientStats.admins} admins${unknownText})`
			)
		}
	}, STATUS_LOG_INTERVAL)
}

// Send sync message to all clients every 5 seconds
function startSyncBroadcast() {
	setInterval(() => {
		websocketService.broadcastSync()
	}, SYNC_BROADCAST_INTERVAL)
}

module.exports = {
	startStatusLogging,
	startSyncBroadcast
} 