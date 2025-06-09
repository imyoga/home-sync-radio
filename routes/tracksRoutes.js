const express = require('express')
const router = express.Router()
const tracksController = require('../controllers/tracksController')

// Get all tracks
router.get('/', tracksController.getAllTracks)

// Get detailed metadata for a specific track
router.get('/:id/metadata', tracksController.getTrackMetadata)

// Get format statistics
router.get('/formats/statistics', tracksController.getFormatStatistics)

module.exports = router 