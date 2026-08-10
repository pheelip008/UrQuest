const prisma = require('../../../prisma/prisma');

async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { orgRole: true }
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  const level = 1 + Math.floor(user.totalXp / 100);

  // Calculate rank (number of users with more XP + 1)
  const usersAbove = await prisma.user.count({
    where: { totalXp: { gt: user.totalXp } }
  });
  const rank = usersAbove + 1;

  // Get submission history
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: { task: { select: { title: true } } }
  });

  const history = submissions.map(s => ({
    title: s.task.title,
    status: s.status
  }));

  const completed_missions = submissions.filter(s => s.status === 'APPROVED').length;
  const streak = 1; // Placeholder for streak

  return {
    username: user.username,
    total_xp: user.totalXp,
    level,
    rank,
    role_name: user.orgRole?.name || null,
    history,
    completed_missions,
    streak
  };
}

async function getLeaderboard() {
  const users = await prisma.user.findMany({
    orderBy: { totalXp: 'desc' },
    take: 10,
    select: { username: true, totalXp: true }
  });

  return users.map(u => ({
    username: u.username,
    total_xp: u.totalXp
  }));
}

module.exports = { getUserProfile, getLeaderboard };
