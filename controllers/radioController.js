const radioStateService = require('../services/radioStateService')
const websocketService = require('../services/websocketService')

class RadioController {
	// Control radio playback
	async controlRadio(req, res) {
		const { action } = req.params
		const { trackId } = req.body
		const clientIP = req.ip || req.connection.remoteAddress || 'unknown'

		console.log(`🎛️ ADMIN ACTION: ${action.toUpperCase()} from ${clientIP}`)

		let success = false
		let message = ''

		switch (action) {
			case 'play':
				success = radioStateService.play()
				if (success) {
					const currentTrack = radioStateService.getCurrentTrack()
					message = `▶️ Radio RESUMED - Now playing: ${currentTrack?.name || 'None'}`
					console.log(`   ${message}`)
					websocketService.broadcastPlaybackState()
				} else {
					message = '⚠️ Radio was already playing'
					console.log(`   ${message}`)
				}
				break

			case 'pause':
				success = radioStateService.pause()
				if (success) {
					const currentTrack = radioStateService.getCurrentTrack()
					const state = radioStateService.getState()
					message = `⏸️ Radio PAUSED - Was playing: ${
						currentTrack?.name || 'None'
					} at position ${radioStateService.formatTime(state.pausedPosition)}`
					console.log(`   ${message}`)
					websocketService.broadcastPlaybackState()
				} else {
					message = '⚠️ Radio was already paused'
					console.log(`   ${message}`)
				}
				break

			case 'stop':
				success = radioStateService.stop()
				const currentTrack = radioStateService.getCurrentTrack()
				message = `⏹️ Radio STOPPED and RESET - Track: ${currentTrack?.name || 'None'}`
				console.log(`   ${message}`)
				websocketService.broadcastPlaybackState()
				break

			case 'select':
				if (trackId !== undefined) {
					success = radioStateService.selectTrack(trackId)
					if (success) {
						const newTrack = radioStateService.getCurrentTrack()
						message = `🎯 TRACK SELECTED: → ${newTrack.name} (ID: ${trackId})`
						console.log(`   ${message}`)
						websocketService.broadcastTrackChange()
					} else {
						message = `⚠️ Invalid track selection - ID: ${trackId}`
						console.log(`   ${message}`)
					}
				} else {
					message = `⚠️ Invalid track selection - ID: ${trackId}`
					console.log(`   ${message}`)
				}
				break

			default:
				message = `❌ Unknown action: ${action}`
				console.log(`   ${message}`)
		}

		const state = radioStateService.getState()
		const clientStats = websocketService.getClientStats()

		res.json({
			success: action === 'stop' || success,
			message,
			isPlaying: state.isPlaying,
			currentTrack: state.currentTrack ? state.currentTrack.name : null,
			currentTrackIndex: state.currentTrackIndex,
			startTime: state.startTime,
			clients: clientStats,
		})
	}

	// Get current radio status
	async getRadioStatus(req, res) {
		// Check if track should change automatically
		const trackChanged = radioStateService.checkTrackChange()
		if (trackChanged) {
			websocketService.broadcastTrackChange()
		}

		const state = radioStateService.getState()
		const currentTrack = radioStateService.getCurrentTrack()
		const clientStats = websocketService.getClientStats()

		let currentTimeSeconds
		if (state.isPlaying) {
			currentTimeSeconds = Math.round(
				((Date.now() - state.startTime) %
					(currentTrack?.estimatedDurationMs || 1)) /
					1000
			)
		} else {
			currentTimeSeconds = Math.round(state.pausedPosition / 1000)
		}

		res.json({
			isPlaying: state.isPlaying,
			currentTrack: currentTrack
				? {
						id: currentTrack.id,
						name: currentTrack.name,
						filename: currentTrack.filename,
						duration: Math.round(currentTrack.estimatedDurationMs / 1000),
				  }
				: null,
			currentTrackIndex: state.currentTrackIndex,
			currentPosition: radioStateService.getCurrentPosition(),
			currentTimeSeconds: currentTimeSeconds,
			pausedPosition: Math.round(state.pausedPosition / 1000),
			startTime: state.startTime,
			totalTracks: require('../services/musicService').getTrackCount(),
			clients: clientStats,
		})
	}
}

module.exports = new RadioController() 