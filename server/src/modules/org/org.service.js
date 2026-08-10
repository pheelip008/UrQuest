const prisma = require('../../../prisma/prisma');

async function checkOrgTaskPermission(userId, orgId) {
  // Check if user is the org owner
  const org = await prisma.organization.findUnique({
    where: { id: orgId }
  });
  if (org && org.ownerUserId === userId) return true;

  // Check if user has a role with canCreateTask permission
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgRole: true }
  });
  if (user && user.memberOrgId === orgId && user.orgRole?.canCreateTask) {
    return true;
  }

  return false;
}

async function listOrgs() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true }
  });
  return orgs.map(o => ({ org_id: o.id, name: o.name }));
}

async function getPublicOrg(orgId) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: { select: { members: true } }
    }
  });

  if (!org) return null;

  return {
    org_id: org.id,
    name: org.name,
    description: org.description || "No briefing available.",
    image_url: org.imageUrl || "default_faction.png",
    member_count: org._count.members
  };
}

async function createOrg(ownerUserId, name) {
  // Check if name is taken
  const existing = await prisma.organization.findUnique({
    where: { name }
  });
  if (existing) {
    return { success: false, message: "Name taken" };
  }

  const org = await prisma.organization.create({
    data: { name, ownerUserId }
  });

  // Set the owner as a member of the org
  await prisma.user.update({
    where: { id: ownerUserId },
    data: { memberOrgId: org.id }
  });

  return { success: true, org_id: org.id, name: org.name };
}

async function joinOrg(userId, orgId) {
  await prisma.user.update({
    where: { id: userId },
    data: { memberOrgId: orgId, orgRoleId: null }
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId }
  });

  return { success: true, org_name: org.name };
}

async function leaveOrg(userId, orgId) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId }
  });

  if (org && org.ownerUserId === userId) {
    return { success: false, message: "Commander cannot leave. Transfer command first." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { memberOrgId: null, orgRoleId: null }
  });

  return { success: true, message: "Left organization" };
}

async function updateOrg(orgId, userId, data) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId }
  });

  if (!org || org.ownerUserId !== userId) {
    return { success: false, message: "Not authorized" };
  }

  const updateData = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (data.image_url !== undefined) updateData.imageUrl = data.image_url;
  if (data.name !== undefined) {
    // Check if new name is taken
    const existing = await prisma.organization.findUnique({
      where: { name: data.name }
    });
    if (existing && existing.id !== orgId) {
      return { success: false, message: "Name taken" };
    }
    updateData.name = data.name;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: updateData
  });

  return { success: true };
}

async function getOrgStats(orgId) {
  const activeTasks = await prisma.task.count({
    where: { creatorOrgId: orgId, status: 'OPEN' }
  });

  const pendingSubmissions = await prisma.submission.count({
    where: {
      task: { creatorOrgId: orgId },
      status: 'PENDING'
    }
  });

  return { active_tasks: activeTasks, pending_submissions: pendingSubmissions };
}

async function getOrgMembers(orgId) {
  const members = await prisma.user.findMany({
    where: { memberOrgId: orgId },
    include: { orgRole: true }
  });

  return members.map(m => ({
    user_id: m.id,
    username: m.username,
    total_xp: m.totalXp,
    role_name: m.orgRole?.name || null
  }));
}

async function getOrgReviews(orgId) {
  const submissions = await prisma.submission.findMany({
    where: {
      task: { creatorOrgId: orgId },
      status: 'PENDING'
    },
    include: {
      task: true,
      user: true
    }
  });

  return submissions.map(s => ({
    submission_id: s.id,
    proof_link: s.proofLink,
    task_title: s.task.title,
    student_name: s.user.username,
    xp_reward: s.task.xpReward
  }));
}

// --- Role Management ---

async function createRole(ownerUserId, orgId, name, rank, canCreateTask) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId }
  });

  if (!org || org.ownerUserId !== ownerUserId) {
    return { success: false, message: "Owner only" };
  }

  await prisma.orgRole.create({
    data: { orgId, name, rank, canCreateTask }
  });

  return { success: true };
}

async function getRoles(orgId) {
  const roles = await prisma.orgRole.findMany({
    where: { orgId }
  });

  return roles.map(r => ({
    role_id: r.id,
    org_id: r.orgId,
    name: r.name,
    rank: r.rank,
    can_create_task: r.canCreateTask
  }));
}

async function assignRole(ownerUserId, targetUserId, roleId) {
  await prisma.user.update({
    where: { id: targetUserId },
    data: { orgRoleId: roleId }
  });

  return { success: true };
}

async function transferOwnership(currentOwnerId, password, newOwnerId, orgId) {
  const bcrypt = require('bcrypt');
  const owner = await prisma.user.findUnique({
    where: { id: currentOwnerId }
  });

  if (!owner || !owner.password) {
    return { success: false, message: "Invalid credentials" };
  }

  const isMatch = await bcrypt.compare(password, owner.password);
  if (!isMatch) {
    return { success: false, message: "Invalid password" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { ownerUserId: newOwnerId }
  });

  return { success: true };
}

module.exports = {
  checkOrgTaskPermission,
  listOrgs,
  getPublicOrg,
  createOrg,
  joinOrg,
  leaveOrg,
  updateOrg,
  getOrgStats,
  getOrgMembers,
  getOrgReviews,
  createRole,
  getRoles,
  assignRole,
  transferOwnership
};
