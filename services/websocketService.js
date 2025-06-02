const WebSocket = require('ws')
const musicService = require('./musicService')
const radioStateService = require('./radioStateService')

class WebSocketService {
	constructor() {
		this.clients = []
		this.adminClients = 0
		this.listenerClients = 0
	}

	initialize(server) {
		this.wss = new WebSocket.Server({ server })
		this.setupWebSocketHandlers()
		return this.wss
	}

	setupWebSocketHandlers() {
		this.wss.on('connection', (ws, req) => {
			this.handleConnection(ws, req)
		})
	}

	handleConnection(ws, req) {
		const clientIP = req.socket.remoteAddress

		// Set default client type (will be updated when client identifies itself)
		ws.clientType = 'unknown'

		console.log(`🔌 New WebSocket connection from: ${clientIP}`)

		// Add to clients list
		this.clients.push(ws)

		// Send initial track data
		this.sendInitialData(ws)

		// Handle WebSocket messages from client
		ws.on('message', (message) => {
			this.handleMessage(ws, message)
		})

		// Handle client disconnect
		ws.on('close', () => {
			this.handleDisconnect(ws, clientIP)
		})
	}

	sendInitialData(ws) {
		const currentTrack = radioStateService.getCurrentTrack()
		
		if (currentTrack) {
			const state = radioStateService.getState()
			const musicFiles = musicService.getMusicFiles()
			
			ws.send(
				JSON.stringify({
					type: 'initial',
					trackId: currentTrack.id,
					trackName: currentTrack.name,
					isPlaying: state.isPlaying,
					serverTime: Date.now(),
					startTime: state.startTime,
					currentPosition: state.currentPosition,
					trackDuration: currentTrack.estimatedDurationMs,
					tracks: musicFiles.map((track) => ({
						id: track.id,
						name: track.name,
					})),
					clients: this.getClientStats(),
				})
			)

			// Send audio data if available
			const audioBuffer = musicService.getAudioBuffer()
			if (audioBuffer) {
				console.log(
					`📤 Sending audio data to client: ${Math.round(
						audioBuffer.length / 1024
					)} KB`
				)
				ws.send(audioBuffer)
			}
		}
	}

	handleMessage(ws, message) {
		try {
			const data = JSON.parse(message)
			console.log(
				`📩 Received message: ${data.type} from ${ws.clientType || 'unknown'}`
			)

			switch (data.type) {
				case 'identify':
					this.handleIdentify(ws, data)
					break
				case 'requestSync':
					this.handleRequestSync(ws)
					break
				case 'getTrackList':
					this.handleGetTrackList(ws)
					break
				case 'getPlaybackState':
					this.handleGetPlaybackState(ws)
					break
			}
		} catch (e) {
			console.error('Invalid message:', e)
		}
	}

	handleIdentify(ws, data) {
		const oldType = ws.clientType

		// Update client counts based on previous type (decrement)
		if (oldType === 'admin') this.adminClients--
		else if (oldType === 'listener') this.listenerClients--

		// Set new client type
		ws.clientType = data.clientType || 'listener'

		// Update client counts based on new type (increment)
		if (ws.clientType === 'admin') this.adminClients++
		else if (ws.clientType === 'listener') this.listenerClients++

		console.log(
			`👤 Client identified as: ${ws.clientType} (was: ${oldType})`
		)
	}

	handleRequestSync(ws) {
		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		
		ws.send(
			JSON.stringify({
				type: 'sync',
				serverTime: Date.now(),
				trackId: currentTrack ? currentTrack.id : null,
				isPlaying: state.isPlaying,
				startTime: state.startTime,
				currentPosition: state.currentPosition,
				trackDuration: currentTrack ? currentTrack.estimatedDurationMs : 0,
				clients: this.getClientStats(),
			})
		)
	}

	handleGetTrackList(ws) {
		const musicFiles = musicService.getMusicFiles()
		
		ws.send(
			JSON.stringify({
				type: 'tracks',
				tracks: musicFiles.map((track) => ({
					id: track.id,
					name: track.name,
					sizeMB: Math.round((track.size / 1024 / 1024) * 10) / 10, // Size in MB with one decimal
					duration: Math.round(track.estimatedDurationMs / 1000), // Duration in seconds
				})),
				clients: this.getClientStats(),
			})
		)
	}

	handleGetPlaybackState(ws) {
		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		
		ws.send(
			JSON.stringify({
				type: 'playbackState',
				isPlaying: state.isPlaying,
				trackId: currentTrack ? currentTrack.id : null,
				currentPosition: state.currentPosition,
				clients: this.getClientStats(),
			})
		)
	}

	handleDisconnect(ws, clientIP) {
		console.log(
			`🔌 WebSocket ${ws.clientType || 'unknown'} disconnected: ${clientIP}`
		)

		// Update client type counts
		if (ws.clientType === 'admin') {
			this.adminClients--
		} else if (ws.clientType === 'listener') {
			this.listenerClients--
		}

		this.clients = this.clients.filter((client) => client !== ws)
	}

	// Broadcast methods
	broadcastTrackChange() {
		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		
		const message = JSON.stringify({
			type: 'trackChange',
			trackId: currentTrack.id,
			trackName: currentTrack.name,
			serverTime: Date.now(),
			startTime: state.startTime,
			clients: this.getClientStats(),
		})

		this.broadcast(message)
	}

	broadcastPlaybackState() {
		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		
		const message = JSON.stringify({
			type: 'playbackState',
			isPlaying: state.isPlaying,
			serverTime: Date.now(),
			currentPosition: state.currentPosition,
			startTime: state.startTime,
			clients: this.getClientStats(),
		})

		this.broadcast(message)
	}

	broadcastSync() {
		const currentTrack = radioStateService.getCurrentTrack()
		const state = radioStateService.getState()
		
		const syncData = {
			type: 'sync',
			serverTime: Date.now(),
			trackId: currentTrack ? currentTrack.id : null,
			isPlaying: state.isPlaying,
			startTime: state.startTime,
			currentPosition: state.currentPosition,
			trackDuration: currentTrack ? currentTrack.estimatedDurationMs : 0,
			clients: this.getClientStats(),
		}

		this.broadcast(JSON.stringify(syncData))
	}

	broadcast(message) {
		this.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(message)
			}
		})
	}

	getClientStats() {
		const unknown = this.clients.length - (this.listenerClients + this.adminClients)
		return {
			total: this.clients.length,
			listeners: this.listenerClients,
			admins: this.adminClients,
			unknown: unknown,
		}
	}

	getClients() {
		return this.clients
	}
}

module.exports = new WebSocketService() 