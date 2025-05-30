const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')
const mp3Duration = require('mp3-duration')
const util = require('util')
const app = express()
const PORT = 3002

// Promisify mp3Duration for async/await usage
const getMP3Duration = util.promisify(mp3Duration)

// Create HTTP server
const server = http.createServer(app)

// Create WebSocket server
const wss = new WebSocket.Server({ server })

// Radio state
let radioStartTime = Date.now()
let isPlaying = false
let currentTrackIndex = 0
let musicFiles = []
let currentTrack = null
let pausedPosition = 0
let clients = []
let adminClients = 0
let listenerClients = 0
let audioBuffer = null
let audioContext = null

// Music directory
const musicDir = path.join(__dirname, 'music')

// Load all music files from the music directory
async function loadMusicFiles() {
	try {
		const files = fs.readdirSync(musicDir)
		const validFiles = files.filter(
			(file) =>
				file.toLowerCase().endsWith('.mp3') ||
				file.toLowerCase().endsWith('.ogg')
		)

		// Process each file to get metadata
		musicFiles = []
		for (const [index, file] of validFiles.entries()) {
			const filePath = path.join(musicDir, file)
			const stat = fs.statSync(filePath)

			try {
				// Get actual MP3 duration if it's an MP3 file
				let durationMs = 0
				if (file.toLowerCase().endsWith('.mp3')) {
					const durationSeconds = await getMP3Duration(filePath)
					durationMs = durationSeconds * 1000
				} else {
					// Fallback estimation for non-MP3 files
					durationMs = (stat.size * 8) / (128000 / 1000)
				}

				musicFiles.push({
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
				musicFiles.push({
					id: index,
					filename: file,
					name: file.replace(/\.[^/.]+$/, ''),
					path: filePath,
					size: stat.size,
					estimatedDurationMs: (stat.size * 8) / (128000 / 1000), // Fallback estimation
				})
			}
		}

		if (musicFiles.length > 0) {
			currentTrack = musicFiles[0]
			console.log(`🎵 Loaded ${musicFiles.length} music files`)
			// Remove individual track listing here since we show it later
			
			// Load the first track
			preloadCurrentTrack()
		} else {
			console.log('❌ No music files found in music directory')
		}
	} catch (error) {
		console.error('❌ Error loading music files:', error)
		musicFiles = []
	}
}

// Preload the current track into memory
function preloadCurrentTrack() {
	if (!currentTrack) return

	fs.readFile(currentTrack.path, (err, data) => {
		if (err) {
			console.error('Error reading audio file:', err)
			return
		}

		audioBuffer = data
		console.log(
			`🎵 Preloaded: ${currentTrack.name} (${Math.round(
				audioBuffer.length / 1024
			)} KB)`
		)
	})
}

// Initialize music files
// loadMusicFiles() - Removing this to prevent double loading of tracks, since we already call it at server startup

// Radio starts in paused state - wait for admin panel command to playisPlaying = false

// Get current playback position in the current track
function getCurrentPosition() {
	if (!currentTrack) return 0

	if (isPlaying) {
		const elapsed = Date.now() - radioStartTime
		const position = elapsed % currentTrack.estimatedDurationMs
		return position / currentTrack.estimatedDurationMs // Return as percentage (0-1)
	} else {
		// When paused, return the saved position
		return pausedPosition / currentTrack.estimatedDurationMs
	}
}

// Get current time in milliseconds
function getCurrentTimeMs() {
	if (!currentTrack) return 0

	if (isPlaying) {
		return (Date.now() - radioStartTime) % currentTrack.estimatedDurationMs
	} else {
		return pausedPosition
	}
}

// Format time for logging
function formatTime(ms) {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Check if current track should switch to next
function checkTrackChange() {
	if (!currentTrack || !isPlaying) return false

	const elapsed = Date.now() - radioStartTime
	if (elapsed >= currentTrack.estimatedDurationMs) {
		// Move to next track
		const oldTrack = currentTrack.name
		currentTrackIndex = (currentTrackIndex + 1) % musicFiles.length
		currentTrack = musicFiles[currentTrackIndex]
		radioStartTime = Date.now()
		pausedPosition = 0 // Reset paused position on track change
		console.log(`🔄 Auto-switched: ${oldTrack} → ${currentTrack.name}`)

		// Preload the new track
		preloadCurrentTrack()

		// Notify all connected clients about track change
		broadcastTrackChange()

		return true
	}
	return false
}

// Broadcast track change to all connected clients
function broadcastTrackChange() {
	const message = JSON.stringify({
		type: 'trackChange',
		trackId: currentTrack.id,
		trackName: currentTrack.name,
		serverTime: Date.now(),
		startTime: radioStartTime,
		clients: {
			total: clients.length,
			listeners: listenerClients,
			admins: adminClients,
			unknown: clients.length - (listenerClients + adminClients),
		},
	})

	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message)
		}
	})
}

// Broadcast playback state change to all connected clients
function broadcastPlaybackState() {
	const message = JSON.stringify({
		type: 'playbackState',
		isPlaying: isPlaying,
		serverTime: Date.now(),
		currentPosition: getCurrentTimeMs(),
		startTime: radioStartTime,
		clients: {
			total: clients.length,
			listeners: listenerClients,
			admins: adminClients,
			unknown: clients.length - (listenerClients + adminClients),
		},
	})

	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message)
		}
	})
}

// Console logging every second
function startStatusLogging() {
	setInterval(() => {
		checkTrackChange() // Check if we need to change tracks

		if (currentTrack) {
			// Calculate current position
			let currentTime
			if (isPlaying) {
				currentTime =
					(Date.now() - radioStartTime) % currentTrack.estimatedDurationMs
			} else {
				currentTime = pausedPosition // Use the saved position when paused
			}

			const totalTime = currentTrack.estimatedDurationMs
			const progress = ((currentTime / totalTime) * 100).toFixed(1)

			const status = isPlaying ? '▶️ PLAYING' : '⏸️ PAUSED'
			const timeDisplay = `${formatTime(currentTime)}/${formatTime(totalTime)}`
			const trackInfo = `[${currentTrackIndex + 1}/${musicFiles.length}] ${
				currentTrack.name
			}`
			const unknown = clients.length - (listenerClients + adminClients)
			const unknownText = unknown > 0 ? `, ❓ ${unknown} unknown` : ''
			const clientInfo = `👥 ${clients.length} clients (👂 ${listenerClients} listeners, 🛠️ ${adminClients} admins${unknownText})`

			console.log(
				`📻 ${status} | ${trackInfo} | ${timeDisplay} (${progress}%) | ${clientInfo}`
			)
		} else {
			const unknown = clients.length - (listenerClients + adminClients)
			const unknownText = unknown > 0 ? `, ❓ ${unknown} unknown` : ''
			console.log(
				`📻 ${isPlaying ? '▶️' : '⏸️'} NO TRACK LOADED | 👥 ${
					clients.length
				} clients (👂 ${listenerClients} listeners, 🛠️ ${adminClients} admins${unknownText})`
			)
		}
	}, 1000)
}

// Send sync message to all clients every 5 seconds
function startSyncBroadcast() {
	setInterval(() => {
		const syncData = {
			type: 'sync',
			serverTime: Date.now(),
			trackId: currentTrack ? currentTrack.id : null,
			isPlaying: isPlaying,
			startTime: radioStartTime,
			currentPosition: getCurrentTimeMs(),
			trackDuration: currentTrack ? currentTrack.estimatedDurationMs : 0,
			clients: {
				total: clients.length,
				listeners: listenerClients,
				admins: adminClients,
			},
		}

		clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(syncData))
			}
		})
	}, 5000)
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
	const clientIP = req.socket.remoteAddress

	// Set default client type (will be updated when client identifies itself)
	ws.clientType = 'unknown'

	console.log(`🔌 New WebSocket connection from: ${clientIP}`)

	// Add to clients list
	clients.push(ws)

	// Send initial track data
	if (currentTrack) {
		ws.send(
			JSON.stringify({
				type: 'initial',
				trackId: currentTrack.id,
				trackName: currentTrack.name,
				isPlaying: isPlaying,
				serverTime: Date.now(),
				startTime: radioStartTime,
				currentPosition: getCurrentTimeMs(),
				trackDuration: currentTrack.estimatedDurationMs,
				tracks: musicFiles.map((track) => ({
					id: track.id,
					name: track.name,
				})),
				clients: {
					total: clients.length,
					listeners: listenerClients,
					admins: adminClients,
					unknown: clients.length - (listenerClients + adminClients),
				},
			})
		)

		// Send audio data if available
		if (audioBuffer) {
			console.log(
				`📤 Sending audio data to client: ${Math.round(
					audioBuffer.length / 1024
				)} KB`
			)
			ws.send(audioBuffer)
		}
	}

	// Handle WebSocket messages from client
	ws.on('message', (message) => {
		try {
			const data = JSON.parse(message)
			console.log(
				`📩 Received message: ${data.type} from ${ws.clientType || 'unknown'}`
			)

			// Handle client identification
			if (data.type === 'identify') {
				const oldType = ws.clientType

				// Update client counts based on previous type (decrement)
				if (oldType === 'admin') adminClients--
				else if (oldType === 'listener') listenerClients--

				// Set new client type
				ws.clientType = data.clientType || 'listener'

				// Update client counts based on new type (increment)
				if (ws.clientType === 'admin') adminClients++
				else if (ws.clientType === 'listener') listenerClients++

				console.log(
					`👤 Client identified as: ${ws.clientType} (was: ${oldType})`
				)

				// No response needed for identification
			} else if (data.type === 'requestSync') {
				// Client requested a sync update
				ws.send(
					JSON.stringify({
						type: 'sync',
						serverTime: Date.now(),
						trackId: currentTrack ? currentTrack.id : null,
						isPlaying: isPlaying,
						startTime: radioStartTime,
						currentPosition: getCurrentTimeMs(),
						trackDuration: currentTrack ? currentTrack.estimatedDurationMs : 0,
						clients: {
							total: clients.length,
							listeners: listenerClients,
							admins: adminClients,
							unknown: clients.length - (listenerClients + adminClients),
						},
					})
				)
			} else if (data.type === 'getTrackList') {
				// Client requested track list
				ws.send(
					JSON.stringify({
						type: 'tracks',
						tracks: musicFiles.map((track) => ({
							id: track.id,
							name: track.name,
							sizeMB: Math.round((track.size / 1024 / 1024) * 10) / 10, // Size in MB with one decimal
							duration: Math.round(track.estimatedDurationMs / 1000), // Duration in seconds
						})),
						clients: {
							total: clients.length,
							listeners: listenerClients,
							admins: adminClients,
						},
					})
				)
			} else if (data.type === 'getPlaybackState') {
				// Client requested current playback state
				ws.send(
					JSON.stringify({
						type: 'playbackState',
						isPlaying: isPlaying,
						trackId: currentTrack ? currentTrack.id : null,
						currentPosition: getCurrentTimeMs(),
						clients: {
							total: clients.length,
							listeners: listenerClients,
							admins: adminClients,
						},
					})
				)
			}
		} catch (e) {
			console.error('Invalid message:', e)
		}
	})

	// Handle client disconnect
	ws.on('close', () => {
		console.log(
			`🔌 WebSocket ${ws.clientType || 'unknown'} disconnected: ${clientIP}`
		)

		// Update client type counts
		if (ws.clientType === 'admin') {
			adminClients--
		} else if (ws.clientType === 'listener') {
			listenerClients--
		}

		clients = clients.filter((client) => client !== ws)
	})
})

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

// API to get all available tracks
app.get('/api/tracks', (req, res) => {
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
})

// API to get current radio status
app.get('/api/radio-status', (req, res) => {
	checkTrackChange() // Update track if needed

	let currentTimeSeconds
	if (isPlaying) {
		currentTimeSeconds = Math.round(
			((Date.now() - radioStartTime) %
				(currentTrack?.estimatedDurationMs || 1)) /
				1000
		)
	} else {
		currentTimeSeconds = Math.round(pausedPosition / 1000)
	}

	res.json({
		isPlaying,
		currentTrack: currentTrack
			? {
					id: currentTrack.id,
					name: currentTrack.name,
					filename: currentTrack.filename,
					duration: Math.round(currentTrack.estimatedDurationMs / 1000),
			  }
			: null,
		currentTrackIndex,
		currentPosition: getCurrentPosition(),
		currentTimeSeconds: currentTimeSeconds,
		pausedPosition: Math.round(pausedPosition / 1000),
		startTime: radioStartTime,
		totalTracks: musicFiles.length,
		clients: {
			total: clients.length,
			listeners: listenerClients,
			admins: adminClients,
		},
	})
})

// API to control radio
app.post('/api/control/:action', (req, res) => {
	const { action } = req.params
	const { trackId } = req.body
	const clientIP = req.ip || req.connection.remoteAddress || 'unknown'

	console.log(`🎛️ ADMIN ACTION: ${action.toUpperCase()} from ${clientIP}`)

	switch (action) {
		case 'play':
			if (!isPlaying) {
				if (pausedPosition > 0) {
					// Resume from paused position
					radioStartTime = Date.now() - pausedPosition
				} else {
					// Start fresh
					radioStartTime = Date.now()
				}
				isPlaying = true
				console.log(
					`   ▶️ Radio RESUMED - Now playing: ${currentTrack?.name || 'None'}`
				)
				broadcastPlaybackState()
			} else {
				console.log(`   ⚠️ Radio was already playing`)
			}
			break

		case 'pause':
			if (isPlaying) {
				// Save current position when pausing
				pausedPosition =
					(Date.now() - radioStartTime) %
					(currentTrack?.estimatedDurationMs || 1)
				isPlaying = false
				console.log(
					`   ⏸️ Radio PAUSED - Was playing: ${
						currentTrack?.name || 'None'
					} at position ${formatTime(pausedPosition)}`
				)
				broadcastPlaybackState()
			} else {
				console.log(`   ⚠️ Radio was already paused`)
			}
			break

		case 'stop':
			isPlaying = false
			radioStartTime = Date.now()
			pausedPosition = 0
			console.log(
				`   ⏹️ Radio STOPPED and RESET - Track: ${currentTrack?.name || 'None'}`
			)
			broadcastPlaybackState()
			break

		case 'select':
			if (trackId !== undefined && musicFiles[trackId]) {
				const oldTrack = currentTrack?.name || 'None'
				currentTrackIndex = trackId
				currentTrack = musicFiles[currentTrackIndex]
				radioStartTime = Date.now()
				pausedPosition = 0
				console.log(
					`   🎯 TRACK SELECTED: ${oldTrack} → ${currentTrack.name} (ID: ${trackId})`
				)
				preloadCurrentTrack()
				broadcastTrackChange()
			} else {
				console.log(`   ⚠️ Invalid track selection - ID: ${trackId}`)
			}
			break

		default:
			console.log(`   ❌ Unknown action: ${action}`)
	}

	res.json({
		success: true,
		isPlaying,
		currentTrack: currentTrack ? currentTrack.name : null,
		currentTrackIndex,
		startTime: radioStartTime,
		clients: {
			total: clients.length,
			listeners: listenerClients,
			admins: adminClients,
		},
	})
})

// Start the server
server.listen(PORT, async () => {
	console.log(
		`🎵 HomeSync Synchronized Radio Server running at http://localhost:${PORT}`
	)
	console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin`)

	// Load music files asynchronously
	await loadMusicFiles()

	// Show comprehensive track listing
	if (musicFiles.length > 0) {
		console.log(`\n🎧 Available Tracks:`)
		musicFiles.forEach((track, i) => {
			const indicator = i === currentTrackIndex ? '▶️' : '  '
			console.log(
				`${indicator} ${i + 1}. ${track.name} (${Math.round(
					track.estimatedDurationMs / 1000
				)}s)`
			)
		})
		
		console.log(`\n🎧 Current Track: ${currentTrack.name}`)
		console.log(
			`📅 Radio initialized at: ${new Date(
				radioStartTime
			).toLocaleTimeString()}`
		)
		if (isPlaying) {
			console.log(`▶️ Radio is PLAYING automatically.`)
		} else {
			console.log(`⏸️ Radio is PAUSED. Use admin panel to start playback.`)
		}
	} else {
		console.log('\n⚠️  No music files found. Please add MP3 or OGG files to the "music" directory.')
	}

	console.log(`\n🔄 Starting sync broadcast service...`)
	startSyncBroadcast()

	console.log(`📻 Starting status logging...`)
	startStatusLogging()
})
