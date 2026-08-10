const userService = require("./user.service");

async function getProfile(req, res) {
  const userId = req.query.user_id || req.userId;
  const result = await userService.getUserProfile(userId);
  if (!result.success && result.message) return res.status(404).json(result);
  return res.json(result);
}

async function getLeaderboard(req, res) {
  const data = await userService.getLeaderboard();
  return res.json(data);
}

module.exports = { getProfile, getLeaderboard };
