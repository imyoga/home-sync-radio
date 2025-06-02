const path = require('path')

module.exports = {
	PORT: 3002,
	MUSIC_DIR: path.join(__dirname, '..', 'music'),
	PUBLIC_DIR: path.join(__dirname, '..', 'public'),
	
	// WebSocket sync intervals
	SYNC_BROADCAST_INTERVAL: 5000, // 5 seconds
	STATUS_LOG_INTERVAL: 1000, // 1 second
	
	// Supported audio formats
	SUPPORTED_AUDIO_FORMATS: ['.mp3', '.ogg'],
	
	// Default audio bitrate for estimation
	DEFAULT_BITRATE: 128000, // 128 kbps
} 