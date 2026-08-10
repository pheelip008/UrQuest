const express = require('express');
const router = express.Router();
const controller = require('./tasks.controller');
const requireAuth = require('../../middleware/authMiddleware');

router.post('/create', requireAuth, controller.createTask);
router.get('/available', requireAuth, controller.getAvailableTasks);
router.post('/submit', requireAuth, controller.submitProof);

module.exports = router;
