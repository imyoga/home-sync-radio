const musicService = require('./musicService')

class RadioStateService {
	constructor() {
		this.radioStartTime = Date.now()
		this.isPlaying = false
		this.currentTrackIndex = 0
		this.currentTrack = null
		this.pausedPosition = 0
	}

	// Initialize with first track from music service
	initialize() {
		const musicFiles = musicService.getMusicFiles()
		if (musicFiles.length > 0) {
			this.currentTrack = musicFiles[0]
			musicService.preloadTrack(this.currentTrack)
		}
	}

	// Get current playback position in the current track
	getCurrentPosition() {
		if (!this.currentTrack) return 0

		if (this.isPlaying) {
			const elapsed = Date.now() - this.radioStartTime
			const position = elapsed % this.currentTrack.estimatedDurationMs
			return position / this.currentTrack.estimatedDurationMs // Return as percentage (0-1)
		} else {
			// When paused, return the saved position
			return this.pausedPosition / this.currentTrack.estimatedDurationMs
		}
	}

	// Get current time in milliseconds
	getCurrentTimeMs() {
		if (!this.currentTrack) return 0

		if (this.isPlaying) {
			return (Date.now() - this.radioStartTime) % this.currentTrack.estimatedDurationMs
		} else {
			return this.pausedPosition
		}
	}

	// Format time for logging
	formatTime(ms) {
		const totalSeconds = Math.floor(ms / 1000)
		const minutes = Math.floor(totalSeconds / 60)
		const seconds = totalSeconds % 60
		return `${minutes}:${seconds.toString().padStart(2, '0')}`
	}

	// Check if current track should switch to next
	checkTrackChange() {
		if (!this.currentTrack || !this.isPlaying) return false

		const elapsed = Date.now() - this.radioStartTime
		if (elapsed >= this.currentTrack.estimatedDurationMs) {
			// Move to next track
			const oldTrack = this.currentTrack.name
			const musicFiles = musicService.getMusicFiles()
			this.currentTrackIndex = (this.currentTrackIndex + 1) % musicFiles.length
			this.currentTrack = musicFiles[this.currentTrackIndex]
			this.radioStartTime = Date.now()
			this.pausedPosition = 0 // Reset paused position on track change
			console.log(`🔄 Auto-switched: ${oldTrack} → ${this.currentTrack.name}`)

			// Preload the new track
			musicService.preloadTrack(this.currentTrack)

			return true
		}
		return false
	}

	// Control methods
	play() {
		if (!this.isPlaying) {
			if (this.pausedPosition > 0) {
				// Resume from paused position
				this.radioStartTime = Date.now() - this.pausedPosition
			} else {
				// Start fresh
				this.radioStartTime = Date.now()
			}
			this.isPlaying = true
			return true
		}
		return false
	}

	pause() {
		if (this.isPlaying) {
			// Save current position when pausing
			this.pausedPosition =
				(Date.now() - this.radioStartTime) %
				(this.currentTrack?.estimatedDurationMs || 1)
			this.isPlaying = false
			return true
		}
		return false
	}

	stop() {
		this.isPlaying = false
		this.radioStartTime = Date.now()
		this.pausedPosition = 0
		return true
	}

	selectTrack(trackId) {
		const track = musicService.getTrackById(trackId)
		if (track) {
			this.currentTrackIndex = trackId
			this.currentTrack = track
			this.radioStartTime = Date.now()
			this.pausedPosition = 0
			musicService.preloadTrack(this.currentTrack)
			return true
		}
		return false
	}

	// Getters
	getState() {
		return {
			isPlaying: this.isPlaying,
			currentTrack: this.currentTrack,
			currentTrackIndex: this.currentTrackIndex,
			startTime: this.radioStartTime,
			currentPosition: this.getCurrentTimeMs(),
			pausedPosition: this.pausedPosition,
		}
	}

	getCurrentTrack() {
		return this.currentTrack
	}

	getIsPlaying() {
		return this.isPlaying
	}

	getCurrentTrackIndex() {
		return this.currentTrackIndex
	}

	getStartTime() {
		return this.radioStartTime
	}
}

module.exports = new RadioStateService() 