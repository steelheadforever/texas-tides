/**
 * Authentication routes for admin dashboard
 * Handles login, logout, and session checking
 */

import express from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for auth endpoints - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  skipSuccessfulRequests: true, // Don't count successful logins
  message: { success: false, error: 'Too many login attempts. Please try again later.' }
});

/**
 * POST /admin/login
 * Authenticate user and create session
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get environment variables at runtime
    const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME || 'admin';
    const DASHBOARD_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Check username
    if (username !== DASHBOARD_USERNAME) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    if (!DASHBOARD_PASSWORD_HASH) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const isValidPassword = await bcrypt.compare(password, DASHBOARD_PASSWORD_HASH);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Create session
    req.session.authenticated = true;
    req.session.username = username;

    res.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/logout
 * Destroy session and logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }

    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

export default router;
