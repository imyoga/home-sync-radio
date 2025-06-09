const musicService = require('../services/musicService')
const radioStateService = require('../services/radioStateService')

class TracksController {
	// Get all available tracks with enhanced metadata
	async getAllTracks(req, res) {
		const musicFiles = musicService.getMusicFiles()
		const currentTrackIndex = radioStateService.getCurrentTrackIndex()

		res.json({
			tracks: musicFiles.map((track) => ({
				id: track.id,
				name: track.name,
				filename: track.filename,
				duration: Math.round(track.estimatedDurationMs / 1000),
				// Enhanced metadata
				title: track.title,
				artist: track.artist,
				album: track.album,
				genre: track.genre,
				year: track.year,
				bitrate: track.bitrate,
				sampleRate: track.sampleRate,
				channels: track.numberOfChannels,
				codec: track.codec,
				container: track.container,
				fileSize: track.size
			})),
			currentTrackIndex,
			total: musicFiles.length,
			formatStatistics: musicService.getFormatStatistics()
		})
	}

	// Get detailed metadata for a specific track
	async getTrackMetadata(req, res) {
		const trackId = parseInt(req.params.id)
		const metadata = musicService.getTrackMetadata(trackId)
		
		if (!metadata) {
			return res.status(404).json({ error: 'Track not found' })
		}
		
		res.json(metadata)
	}

	// Get format statistics
	async getFormatStatistics(req, res) {
		const stats = musicService.getFormatStatistics()
		const supportedFormats = require('../config/constants').SUPPORTED_AUDIO_FORMATS
		
		res.json({
			supportedFormats,
			statistics: stats,
			totalTracks: musicService.getTrackCount()
		})
	}
}

module.exports = new TracksController() 