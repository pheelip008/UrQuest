function ValidateRegister(req, res, next) {
  const { username, email, password } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({
      success: false,
      message: "All fields are required (username, email, password)"
    });
  }

  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Username must be at least 3 characters"
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters"
    });
  }

  next();
}

function ValidateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  next();
}

module.exports = { ValidateRegister, ValidateLogin };
