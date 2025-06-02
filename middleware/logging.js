// Request logging middleware
const requestLogger = (req, res, next) => {
	const timestamp = new Date().toISOString()
	const method = req.method
	const url = req.originalUrl
	const ip = req.ip || req.connection.remoteAddress || 'unknown'
	
	console.log(`📡 ${timestamp} - ${method} ${url} from ${ip}`)
	next()
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
	console.error('❌ Error:', err.message)
	console.error('Stack:', err.stack)
	
	res.status(500).json({
		success: false,
		message: 'Internal server error',
		error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
	})
}

module.exports = {
	requestLogger,
	errorHandler
} 