const musicService = require('../services/musicService')
const radioStateService = require('../services/radioStateService')

class TracksController {
	// Get all available tracks
	async getAllTracks(req, res) {
		const musicFiles = musicService.getMusicFiles()
		const currentTrackIndex = radioStateService.getCurrentTrackIndex()

		res.json({
			tracks: musicFiles.map((track) => ({
				id: track.id,
				name: track.name,
				filename: track.filename,
				duration: Math.round(track.estimatedDurationMs / 1000),
			})),
			currentTrackIndex,
			total: musicFiles.length,
		})
	}
}

module.exports = new TracksController() 