const express = require('express')
const router = express.Router()
const tracksController = require('../controllers/tracksController')

// Get all tracks
router.get('/', tracksController.getAllTracks)

module.exports = router 