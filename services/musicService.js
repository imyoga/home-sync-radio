const fs = require('fs')
const path = require('path')
const mp3Duration = require('mp3-duration')
const util = require('util')
const { MUSIC_DIR, SUPPORTED_AUDIO_FORMATS, DEFAULT_BITRATE } = require('../config/constants')

// Promisify mp3Duration for async/await usage
const getMP3Duration = util.promisify(mp3Duration)

class MusicService {
	constructor() {
		this.musicFiles = []
		this.audioBuffer = null
	}

	async loadMusicFiles() {
		try {
			const files = fs.readdirSync(MUSIC_DIR)
			const validFiles = files.filter(file => 
				SUPPORTED_AUDIO_FORMATS.some(format => 
					file.toLowerCase().endsWith(format)
				)
			)

			// Process each file to get metadata
			this.musicFiles = []
			for (const [index, file] of validFiles.entries()) {
				const filePath = path.join(MUSIC_DIR, file)
				const stat = fs.statSync(filePath)

				try {
					// Get actual MP3 duration if it's an MP3 file
					let durationMs = 0
					if (file.toLowerCase().endsWith('.mp3')) {
						const durationSeconds = await getMP3Duration(filePath)
						durationMs = durationSeconds * 1000
					} else {
						// Fallback estimation for non-MP3 files
						durationMs = (stat.size * 8) / (DEFAULT_BITRATE / 1000)
					}

					this.musicFiles.push({
						id: index,
						filename: file,
						name: file.replace(/\.[^/.]+$/, ''), // Remove extension for display
						path: filePath,
						size: stat.size,
						estimatedDurationMs: durationMs,
					})
				} catch (metadataError) {
					console.error(`Error reading duration for ${file}:`, metadataError)
					// Fallback to estimation if duration parsing fails
					this.musicFiles.push({
						id: index,
						filename: file,
						name: file.replace(/\.[^/.]+$/, ''),
						path: filePath,
						size: stat.size,
						estimatedDurationMs: (stat.size * 8) / (DEFAULT_BITRATE / 1000), // Fallback estimation
					})
				}
			}

			if (this.musicFiles.length > 0) {
				console.log(`🎵 Loaded ${this.musicFiles.length} music files`)
			} else {
				console.log('❌ No music files found in music directory')
			}

			return this.musicFiles
		} catch (error) {
			console.error('❌ Error loading music files:', error)
			this.musicFiles = []
			return []
		}
	}

	preloadTrack(track) {
		if (!track) return

		fs.readFile(track.path, (err, data) => {
			if (err) {
				console.error('Error reading audio file:', err)
				return
			}

			this.audioBuffer = data
			console.log(
				`🎵 Preloaded: ${track.name} (${Math.round(
					this.audioBuffer.length / 1024
				)} KB)`
			)
		})
	}

	getMusicFiles() {
		return this.musicFiles
	}

	getTrackById(id) {
		return this.musicFiles[id] || null
	}

	getAudioBuffer() {
		return this.audioBuffer
	}

	getTrackCount() {
		return this.musicFiles.length
	}
}

module.exports = new MusicService() 