const path = require('path')

module.exports = {
	PORT: 3002,
	MUSIC_DIR: path.join(__dirname, '..', 'music'),
	PUBLIC_DIR: path.join(__dirname, '..', 'public'),
	
	// WebSocket sync intervals
	SYNC_BROADCAST_INTERVAL: 5000, // 5 seconds
	STATUS_LOG_INTERVAL: 1000, // 1 second
	
	// Supported audio formats - expanded to support all major web-compatible formats
	SUPPORTED_AUDIO_FORMATS: [
		// Lossy formats
		'.mp3',    // MPEG-1 Audio Layer III
		'.aac',    // Advanced Audio Coding
		'.m4a',    // MPEG-4 Audio (AAC)
		'.ogg',    // Ogg Vorbis
		'.oga',    // Ogg Audio
		'.opus',   // Opus codec
		'.webm',   // WebM Audio
		
		// Lossless formats
		'.flac',   // Free Lossless Audio Codec
		'.wav',    // Waveform Audio File Format
		'.wave',   // Alternative WAV extension
		'.aiff',   // Audio Interchange File Format
		'.aif',    // Alternative AIFF extension
		'.alac',   // Apple Lossless Audio Codec
		
		// Other common formats
		'.wma',    // Windows Media Audio
		'.amr',    // Adaptive Multi-Rate
		'.3ga',    // 3GPP Audio
		'.mp4',    // MPEG-4 Audio container
		'.m4p',    // iTunes Protected Audio
		'.ape',    // Monkey's Audio
		'.mka',    // Matroska Audio
		'.ra',     // RealAudio
		'.rm',     // RealMedia
		'.ac3',    // Audio Codec 3
		'.dts',    // Digital Theater Systems
		'.au',     // AU Audio
		'.snd',    // Sound file
		'.gsm',    // GSM Audio
		'.voc',    // Creative Voice
		'.8svx'    // 8-Bit Sampled Voice
	],
	
	// Default audio bitrate for estimation
	DEFAULT_BITRATE: 128000, // 128 kbps
} 