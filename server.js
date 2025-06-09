const express = require('express')
const http = require('http')
const path = require('path')

// Import configuration
const { PORT, PUBLIC_DIR } = require('./config/constants')

// Import services
const musicService = require('./services/musicService')
const radioStateService = require('./services/radioStateService')
const websocketService = require('./services/websocketService')

// Import routes
const routes = require('./routes')

// Import middleware
const { requestLogger, errorHandler } = require('./middleware/logging')

// Import utilities
const { startStatusLogging, startSyncBroadcast } = require('./utils/intervals')

// Create Express app
const app = express()

// Create HTTP server
const server = http.createServer(app)

// Middleware setup
app.use(requestLogger)
app.use(express.json())
app.use(express.static(PUBLIC_DIR))

// Routes setup
app.use(routes)

// Error handling middleware (should be last)
app.use(errorHandler)

// Initialize WebSocket service
websocketService.initialize(server)

// Start the server
server.listen(PORT, async () => {
	console.log(
		`🎵 HomeSync Synchronized Radio Server running at http://localhost:${PORT}`
	)
	console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin/index.html`)

	// Load music files asynchronously
	await musicService.loadMusicFiles()

	// Initialize radio state with first track
	radioStateService.initialize()

	// Show comprehensive track listing
	const musicFiles = musicService.getMusicFiles()
	if (musicFiles.length > 0) {
		console.log(`\n🎧 Available Tracks:`)
		musicFiles.forEach((track, i) => {
			const indicator = i === radioStateService.getCurrentTrackIndex() ? '▶️' : '  '
			console.log(
				`${indicator} ${i + 1}. ${track.name} (${Math.round(
					track.estimatedDurationMs / 1000
				)}s)`
			)
		})
		
		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		console.log(`\n🎧 Current Track: ${currentTrack.name}`)
		console.log(
			`📅 Radio initialized at: ${new Date(
				state.startTime
			).toLocaleTimeString()}`
		)
		if (state.isPlaying) {
			console.log(`▶️ Radio is PLAYING automatically.`)
		} else {
			console.log(`⏸️ Radio is PAUSED. Use admin panel to start playback.`)
		}
	} else {
		console.log('\n⚠️  No music files found.')
		console.log('📁 Supported audio formats:')
		console.log('   Lossy: MP3, AAC, M4A, OGG, OGA, OPUS, WEBM')
		console.log('   Lossless: FLAC, WAV, WAVE, AIFF, AIF, ALAC')
		console.log('   Other: WMA, AMR, 3GA, MP4, M4P, APE, MKA, AU, etc.')
		console.log('🎵 Add any supported audio files to the "music" directory.')
	}

	console.log(`\n🔄 Starting sync broadcast service...`)
	startSyncBroadcast()

	console.log(`📻 Starting status logging...`)
	startStatusLogging()
})
