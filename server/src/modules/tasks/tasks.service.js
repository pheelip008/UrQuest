const prisma = require('../../../prisma/prisma');
const { checkOrgTaskPermission } = require('../org/org.service');

async function createTask(userId, data) {
  const { org_id, title, description, xp_reward, difficulty, deadline, visibility, assignee_ids } = data;

  // Permission checks
  if (visibility === 'PRIVATE') {
    if (!org_id) {
      return { success: false, message: "Private tasks must have an Organization." };
    }
    if (!(await checkOrgTaskPermission(userId, org_id))) {
      return { success: false, message: "Permission denied for Org Task" };
    }
  } else {
    // PUBLIC
    if (org_id) {
      if (!(await checkOrgTaskPermission(userId, org_id))) {
        return { success: false, message: "Permission denied for Org Task" };
      }
    }
  }

  const assigneesJson = JSON.stringify(assignee_ids || []);

  await prisma.task.create({
    data: {
      creatorOrgId: org_id || null,
      creatorUserId: userId,
      title,
      description,
      xpReward: xp_reward,
      difficulty,
      deadline: deadline ? new Date(deadline) : null,
      status: 'OPEN',
      visibility: visibility || 'PUBLIC',
      assigneeIds: assigneesJson
    }
  });

  return { success: true };
}

async function getAvailableTasks(userId) {
  // Get user's org membership
  let memberOrgId = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberOrgId: true }
    });
    if (user) memberOrgId = user.memberOrgId;
  }

  const allTasks = await prisma.task.findMany({
    where: { status: 'OPEN' },
    include: {
      creatorOrg: { select: { name: true } },
      creator: { select: { username: true } }
    }
  });

  const visibleTasks = [];

  for (const t of allTasks) {
    let isVisible = false;

    // Rule 1: Public tasks are always visible
    if (t.visibility === 'PUBLIC') {
      isVisible = true;
    }

    // Rule 2: Private tasks visible if user is assignee or member of creator org
    if (t.visibility === 'PRIVATE' && userId) {
      const assignees = JSON.parse(t.assigneeIds || '[]');
      if (assignees.includes(userId)) {
        isVisible = true;
      } else if (memberOrgId && t.creatorOrgId === memberOrgId) {
        isVisible = true;
      }
    }

    if (isVisible) {
      visibleTasks.push({
        task_id: t.id,
        creator_org_id: t.creatorOrgId,
        creator_user_id: t.creatorUserId,
        title: t.title,
        description: t.description,
        xp_reward: t.xpReward,
        difficulty: t.difficulty,
        deadline: t.deadline,
        status: t.status,
        visibility: t.visibility,
        assignee_ids: t.assigneeIds,
        org_name: t.creatorOrg?.name || null,
        creator_name: t.creator?.username || null
      });
    }
  }

  return visibleTasks;
}

async function submitProof(taskId, userId, proofLink) {
  await prisma.submission.create({
    data: {
      taskId,
      userId,
      proofLink
    }
  });

  return { success: true };
}

async function reviewSubmission(submissionId, action, feedback) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { task: true }
  });

  if (!submission) {
    return { success: false, message: "Submission not found" };
  }

  const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status, feedback }
  });

  // If approved, award XP
  if (status === 'APPROVED') {
    await prisma.user.update({
      where: { id: submission.userId },
      data: { totalXp: { increment: submission.task.xpReward } }
    });
  }

  return { success: true };
}

module.exports = {
  createTask,
  getAvailableTasks,
  submitProof,
  reviewSubmission
};
