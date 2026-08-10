const express = require('express');
const router = express.Router();
const validation = require("./auth.validation");
const controller = require("./auth.controller");
const requireAuth = require('../../middleware/authMiddleware');

router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, controller.logout);
router.post('/register', validation.ValidateRegister, controller.register);
router.post('/login', validation.ValidateLogin, controller.login);

module.exports = router;
