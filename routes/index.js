const express = require('express')
const router = express.Router()

// Import route modules
const radioRoutes = require('./radioRoutes')
const tracksRoutes = require('./tracksRoutes')

// Mount API routes
router.use('/api/radio', radioRoutes)
router.use('/api/tracks', tracksRoutes)

module.exports = router 