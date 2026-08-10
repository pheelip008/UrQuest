const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const { CLIENT_ORIGIN } = require('./config/network');
const helmet = require('helmet');
const morgan = require('morgan');
const app = express();
const port = process.env.PORT || 3000;
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Middleware
app.use(passport.initialize());
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));

// Shared cookie options for cross-domain (Vercel frontend <-> Render API)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
};

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('token', token, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${CLIENT_ORIGIN}/user-dashboard.html`);
  }

);

// --- API Routes ---
const authRoutes = require('./modules/auth/auth.routes');
app.use('/api/auth', authRoutes);

const orgRoutes = require('./modules/org/org.routes');
app.use('/api/org', orgRoutes);
// Also mount list at /api/orgs/list for backwards compat with frontend
app.get('/api/orgs/list', require('./modules/org/org.controller').listOrgs);

const taskRoutes = require('./modules/tasks/tasks.routes');
app.use('/api/tasks', taskRoutes);
// Submission review
app.post('/api/submissions/review', require('./middleware/authMiddleware'), require('./modules/tasks/tasks.controller').reviewSubmission);

const userRoutes = require('./modules/user/user.routes');
app.use('/api/user', userRoutes);
// Leaderboard also at root level for backwards compat
app.get('/api/leaderboard', require('./modules/user/user.controller').getLeaderboard);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'URquest API Server' });
});

// Start server
app.listen(port, () => {
  console.log(`URquest API listening on port ${port}`);
});
