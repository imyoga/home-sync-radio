const fs = require('fs')
const path = require('path')
const { parseFile } = require('music-metadata')
const { MUSIC_DIR, SUPPORTED_AUDIO_FORMATS, DEFAULT_BITRATE } = require('../config/constants')

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
					// Use music-metadata to get accurate duration for all supported formats
					const metadata = await parseFile(filePath)
					let durationMs = 0
					
					if (metadata.format && metadata.format.duration) {
						// Use actual duration from metadata
						durationMs = metadata.format.duration * 1000
					} else {
						// Fallback to file size estimation
						console.warn(`Unable to detect duration for ${file}, using estimation`)
						durationMs = (stat.size * 8) / (DEFAULT_BITRATE / 1000)
					}

					// Extract additional metadata
					const trackInfo = {
						id: index,
						filename: file,
						name: file.replace(/\.[^/.]+$/, ''), // Remove extension for display
						path: filePath,
						size: stat.size,
						estimatedDurationMs: durationMs,
						// Additional metadata from music-metadata
						title: metadata.common?.title || file.replace(/\.[^/.]+$/, ''),
						artist: metadata.common?.artist || 'Unknown Artist',
						album: metadata.common?.album || 'Unknown Album',
						genre: metadata.common?.genre ? metadata.common.genre.join(', ') : 'Unknown',
						year: metadata.common?.year || null,
						bitrate: metadata.format?.bitrate || DEFAULT_BITRATE / 1000,
						sampleRate: metadata.format?.sampleRate || 44100,
						numberOfChannels: metadata.format?.numberOfChannels || 2,
						codecProfile: metadata.format?.codecProfile || 'Unknown',
						container: metadata.format?.container || 'Unknown',
						codec: metadata.format?.codec || 'Unknown'
					}

					this.musicFiles.push(trackInfo)

					console.log(`✅ Loaded: ${trackInfo.title} by ${trackInfo.artist} (${Math.round(durationMs / 1000)}s, ${trackInfo.codec})`)
				} catch (metadataError) {
					console.error(`Error reading metadata for ${file}:`, metadataError.message)
					// Fallback to basic file info if metadata parsing fails
					this.musicFiles.push({
						id: index,
						filename: file,
						name: file.replace(/\.[^/.]+$/, ''),
						path: filePath,
						size: stat.size,
						estimatedDurationMs: (stat.size * 8) / (DEFAULT_BITRATE / 1000), // Fallback estimation
						title: file.replace(/\.[^/.]+$/, ''),
						artist: 'Unknown Artist',
						album: 'Unknown Album',
						genre: 'Unknown',
						year: null,
						bitrate: DEFAULT_BITRATE / 1000,
						sampleRate: 44100,
						numberOfChannels: 2,
						codecProfile: 'Unknown',
						container: 'Unknown',
						codec: 'Unknown'
					})
				}
			}

			if (this.musicFiles.length > 0) {
				console.log(`🎵 Successfully loaded ${this.musicFiles.length} music files`)
				
				// Log format statistics
				const formatStats = this.musicFiles.reduce((stats, track) => {
					const ext = path.extname(track.filename).toLowerCase()
					stats[ext] = (stats[ext] || 0) + 1
					return stats
				}, {})
				
				console.log('📊 Format distribution:', formatStats)
			} else {
				console.log('❌ No valid music files found in music directory')
				console.log(`📁 Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`)
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
				`🎵 Preloaded: ${track.title} by ${track.artist} (${Math.round(
					this.audioBuffer.length / 1024
				)} KB, ${track.codec})`
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

	// New method to get detailed track metadata
	getTrackMetadata(id) {
		const track = this.musicFiles[id]
		if (!track) return null
		
		return {
			id: track.id,
			title: track.title,
			artist: track.artist,
			album: track.album,
			genre: track.genre,
			year: track.year,
			duration: Math.round(track.estimatedDurationMs / 1000),
			bitrate: track.bitrate,
			sampleRate: track.sampleRate,
			channels: track.numberOfChannels,
			codec: track.codec,
			container: track.container,
			fileSize: track.size,
			filename: track.filename
		}
	}

	// Method to get format statistics
	getFormatStatistics() {
		return this.musicFiles.reduce((stats, track) => {
			const ext = path.extname(track.filename).toLowerCase()
			const codec = track.codec
			
			if (!stats[ext]) {
				stats[ext] = {
					count: 0,
					codecs: new Set(),
					totalSize: 0,
					totalDuration: 0
				}
			}
			
			stats[ext].count++
			stats[ext].codecs.add(codec)
			stats[ext].totalSize += track.size
			stats[ext].totalDuration += track.estimatedDurationMs
			
			return stats
		}, {})
	}
}

module.exports = new MusicService() 