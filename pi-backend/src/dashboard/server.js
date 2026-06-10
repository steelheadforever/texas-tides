/**
 * Admin Dashboard Server
 * Provides web interface for monitoring Slackwater backend
 */

import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../.env') });

// Import routes
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { checkAuth } from '../middleware/auth.js';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 8080;

// Validate SESSION_SECRET
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('ERROR: SESSION_SECRET must be set and at least 32 characters long');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.USE_HTTPS === 'true', // Enable when behind HTTPS reverse proxy
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Serve static files
app.use('/admin', express.static(join(__dirname, 'public')));

// Authentication routes
app.use('/admin', authRoutes);

// Check auth endpoint
app.get('/admin/check-auth', checkAuth);

// API routes (protected)
app.use('/admin/api', apiRoutes);

// Root redirect to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'dashboard',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`Dashboard URL: http://localhost:${PORT}/admin`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
