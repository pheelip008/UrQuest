const authService = require("./auth.service");

// Must match the options in server.js for cross-domain cookies
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
};

async function register(req, res) {
  const { username, email, password } = req.body;
  const result = await authService.registerUser({ username, email, password });
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

async function login(req, res) {
  const { email, password, rememberMe } = req.body;
  const result = await authService.loginUser({ email, password });
  if (!result.success) {
    return res.status(401).json(result);
  }

  // Set JWT as httpOnly cookie
  res.cookie('token', result.token, {
    ...COOKIE_OPTIONS,
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  });

  // Don't send token in response body (it's in the cookie)
  const { token, ...responseWithoutToken } = result;
  return res.status(200).json(responseWithoutToken);
}

async function me(req, res) {
  const result = await authService.me(req.userId);
  if (!result.success) {
    return res.status(401).json(result);
  }
  return res.status(200).json(result);
}

async function logout(req, res) {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ success: true, message: "Logged out successfully" });
}

module.exports = { register, login, me, logout };

