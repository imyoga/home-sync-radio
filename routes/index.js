const express = require('express')
const router = express.Router()

// Import route modules
const radioRoutes = require('./radioRoutes')
const tracksRoutes = require('./tracksRoutes')

// Mount new API routes
router.use('/api/radio', radioRoutes)
router.use('/api/tracks', tracksRoutes)

// Legacy compatibility routes (maintain backward compatibility)
const radioController = require('../controllers/radioController')

router.post('/api/control/:action', radioController.controlRadio)
router.get('/api/radio-status', radioController.getRadioStatus)

module.exports = router 