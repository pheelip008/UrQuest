const tasksService = require("./tasks.service");

async function createTask(req, res) {
  const result = await tasksService.createTask(req.userId, req.body);
  if (!result.success) {
    const status = result.message.includes("Permission") ? 403 : 400;
    return res.status(status).json(result);
  }
  return res.status(201).json(result);
}

async function getAvailableTasks(req, res) {
  // Use the authenticated user's ID, or allow query param for unauthenticated browsing
  const userId = req.userId || req.query.user_id || null;
  const tasks = await tasksService.getAvailableTasks(userId);
  return res.json(tasks);
}

async function submitProof(req, res) {
  const { task_id, proof_link } = req.body;
  const result = await tasksService.submitProof(task_id, req.userId, proof_link);
  return res.json(result);
}

async function reviewSubmission(req, res) {
  const { submission_id, action, feedback } = req.body;
  const result = await tasksService.reviewSubmission(submission_id, action, feedback);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
}

module.exports = {
  createTask,
  getAvailableTasks,
  submitProof,
  reviewSubmission
};
