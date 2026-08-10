const bcrypt = require('bcrypt');
const prisma = require('../../../prisma/prisma');
const jwt = require('jsonwebtoken');

async function registerUser({ username, email, password }) {
  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({
    where: { email }
  });
  if (existingEmail) {
    return { success: false, message: "Email already registered" };
  }

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({
    where: { username }
  });
  if (existingUsername) {
    return { success: false, message: "Username already taken" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      provider: 'email'
    }
  });

  const { password: _password, ...userWithoutPassword } = user;
  return {
    success: true,
    message: "Registration successful",
    user: userWithoutPassword
  };
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }

  if (!user.password) {
    return { success: false, message: "This account uses Google login. Please sign in with Google." };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { success: false, message: "Invalid email or password" };
  }

  const { password: _password, ...userWithoutPassword } = user;

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    success: true,
    message: "Login successful",
    user: userWithoutPassword,
    token
  };
}

async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberOrg: true,
      orgRole: true,
      ownedOrgs: true
    }
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  const { password: _password, ...userWithoutPassword } = user;

  // Build response matching URquest's rich session format
  const ownedOrg = user.ownedOrgs.length > 0 ? {
    org_id: user.ownedOrgs[0].id,
    name: user.ownedOrgs[0].name,
    description: user.ownedOrgs[0].description,
    image_url: user.ownedOrgs[0].imageUrl
  } : null;

  const memberOrg = user.memberOrg ? {
    org_id: user.memberOrg.id,
    name: user.memberOrg.name,
    description: user.memberOrg.description,
    image_url: user.memberOrg.imageUrl
  } : null;

  return {
    success: true,
    message: "User fetched successfully",
    user: {
      user_id: user.id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      total_xp: user.totalXp,
      member_org_id: user.memberOrgId,
      role_name: user.orgRole?.name || null,
      can_create_task: user.orgRole?.canCreateTask || false
    },
    owned_org: ownedOrg,
    member_org: memberOrg
  };
}

module.exports = { registerUser, loginUser, me };
