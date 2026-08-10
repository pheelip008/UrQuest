const express = require('express');
const router = express.Router();
const controller = require('./user.controller');
const requireAuth = require('../../middleware/authMiddleware');

router.get('/profile', requireAuth, controller.getProfile);
router.get('/leaderboard', controller.getLeaderboard);

module.exports = router;
