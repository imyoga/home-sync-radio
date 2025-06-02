const express = require('express')
const router = express.Router()
const radioController = require('../controllers/radioController')

// Control radio (play, pause, stop, select)
router.post('/control/:action', radioController.controlRadio)

// Get current radio status
router.get('/status', radioController.getRadioStatus)

module.exports = router 