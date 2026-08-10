const orgService = require("./org.service");

async function listOrgs(req, res) {
  const orgs = await orgService.listOrgs();
  return res.json(orgs);
}

async function getPublicOrg(req, res) {
  const orgId = parseInt(req.params.orgId);
  const org = await orgService.getPublicOrg(orgId);
  if (!org) return res.status(404).json({ message: "Organization not found" });
  return res.json(org);
}

async function createOrg(req, res) {
  const { name } = req.body;
  const result = await orgService.createOrg(req.userId, name);
  if (!result.success) return res.status(400).json(result);
  return res.status(201).json(result);
}

async function joinOrg(req, res) {
  const { org_id } = req.body;
  const result = await orgService.joinOrg(req.userId, org_id);
  return res.json(result);
}

async function leaveOrg(req, res) {
  const { org_id } = req.body;
  const result = await orgService.leaveOrg(req.userId, org_id);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
}

async function updateOrg(req, res) {
  const { org_id, description, image_url, name } = req.body;
  const result = await orgService.updateOrg(org_id, req.userId, { description, image_url, name });
  if (!result.success) return res.status(result.message === "Not authorized" ? 403 : 400).json(result);
  return res.json(result);
}

async function getStats(req, res) {
  const orgId = parseInt(req.query.org_id);
  const stats = await orgService.getOrgStats(orgId);
  return res.json(stats);
}

async function getMembers(req, res) {
  const orgId = parseInt(req.query.org_id);
  const members = await orgService.getOrgMembers(orgId);
  return res.json(members);
}

async function getReviews(req, res) {
  const orgId = parseInt(req.query.org_id);
  const reviews = await orgService.getOrgReviews(orgId);
  return res.json(reviews);
}

async function createRole(req, res) {
  const { org_id, name, rank, can_create_task } = req.body;
  const result = await orgService.createRole(req.userId, org_id, name, rank, can_create_task);
  if (!result.success) return res.status(403).json(result);
  return res.json(result);
}

async function getRoles(req, res) {
  const orgId = parseInt(req.query.org_id);
  const roles = await orgService.getRoles(orgId);
  return res.json(roles);
}

async function assignRole(req, res) {
  const { target_user_id, role_id } = req.body;
  const result = await orgService.assignRole(req.userId, target_user_id, role_id);
  return res.json(result);
}

async function transferOwnership(req, res) {
  const { password, new_owner_id, org_id } = req.body;
  const result = await orgService.transferOwnership(req.userId, password, new_owner_id, org_id);
  if (!result.success) return res.status(401).json(result);
  return res.json(result);
}

module.exports = {
  listOrgs,
  getPublicOrg,
  createOrg,
  joinOrg,
  leaveOrg,
  updateOrg,
  getStats,
  getMembers,
  getReviews,
  createRole,
  getRoles,
  assignRole,
  transferOwnership
};
