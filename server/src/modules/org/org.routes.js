const express = require('express');
const router = express.Router();
const controller = require('./org.controller');
const requireAuth = require('../../middleware/authMiddleware');

// Public
router.get('/list', controller.listOrgs);
router.get('/public/:orgId', controller.getPublicOrg);

// Protected
router.post('/create', requireAuth, controller.createOrg);
router.post('/join', requireAuth, controller.joinOrg);
router.post('/leave', requireAuth, controller.leaveOrg);
router.post('/update', requireAuth, controller.updateOrg);
router.get('/stats', requireAuth, controller.getStats);
router.get('/members', requireAuth, controller.getMembers);
router.get('/reviews', requireAuth, controller.getReviews);

// Roles
router.post('/roles/create', requireAuth, controller.createRole);
router.get('/roles', requireAuth, controller.getRoles);
router.post('/roles/assign', requireAuth, controller.assignRole);
router.post('/transfer-ownership', requireAuth, controller.transferOwnership);

module.exports = router;
