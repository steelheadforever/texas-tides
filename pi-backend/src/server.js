import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables first
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import noaaRouter from './routes/noaa.js';
import nwsRouter from './routes/nws.js';
import usnoRouter from './routes/usno.js';

// Import database and middleware
import { runMigrations } from './utils/migrations.js';
import { saveAllDbs } from './config/database.js';
import { cacheMiddleware } from './middleware/cache.js';
import { analyticsMiddleware } from './middleware/analytics.js';
import { getCacheStats, getFetchStats } from './services/cache.js';

// Import background jobs
import { startJobs, stopJobs } from './jobs/scheduler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware with relaxed CSP for external scripts
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "http:"
      ],
      connectSrc: [
        "'self'",
        "https://api.weather.gov",
        "https://api.tidesandcurrents.noaa.gov",
        "https://aa.usno.navy.mil"
      ],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrcAttr: ["'none'"]
      // Removed upgrade-insecure-requests to allow HTTP when not using HTTPS
    }
  }
}));

// CORS configuration - allow frontend to connect
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Cookie parser for session management
app.use(cookieParser());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parse JSON bodies
app.use(express.json());

// Analytics middleware (tracks all requests, privacy-focused)
app.use(analyticsMiddleware());

// Health check endpoint (before caching middleware)
app.get('/health', async (req, res) => {
  try {
    const cacheStats = await getCacheStats();
    const fetchStats = await getFetchStats(24);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: {
        entries: cacheStats.validEntries,
        hitRate: fetchStats.hitRate + '%'
      }
    });
  } catch (err) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
});

// Apply caching middleware to API routes
app.use('/api/', cacheMiddleware());

// API Routes
app.use('/api/noaa', noaaRouter);
app.use('/api/nws', nwsRouter);
app.use('/api/usno', usnoRouter);

// API info endpoint (only for direct /api requests)
app.get('/api', (req, res) => {
  res.json({
    name: 'Slackwater Backend API',
    version: '1.1.0',
    endpoints: {
      health: '/health',
      noaa: '/api/noaa',
      nws: '/api/nws',
      usno: '/api/usno'
    },
    features: {
      caching: 'enabled',
      analytics: process.env.ANALYTICS_ENABLED !== 'false' ? 'enabled' : 'disabled'
    }
  });
});

// Serve static web app files (must be AFTER API routes)
const webAppPath = join(__dirname, '../web');
app.use(express.static(webAppPath, {
  index: 'index.html',
  extensions: ['html']
}));

// Fallback to index.html for client-side routing
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  // Serve index.html for all other routes
  res.sendFile(join(webAppPath, 'index.html'));
});

// 404 handler for API requests only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Run database migrations
    console.log('Initializing database...');
    await runMigrations();

    // Start server
    app.listen(PORT, () => {
      console.log(`Slackwater Backend running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS origin: ${corsOptions.origin}`);
      console.log(`Caching: enabled (TTL: ${process.env.CACHE_TTL_SECONDS || 360}s)`);
      console.log(`Analytics: ${process.env.ANALYTICS_ENABLED !== 'false' ? 'enabled' : 'disabled'}`);
    });

    // Start background jobs
    startJobs();

    // Periodic database save (every 5 minutes)
    setInterval(() => {
      saveAllDbs();
    }, 5 * 60 * 1000);

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping jobs and saving databases...');
  stopJobs();
  saveAllDbs();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, stopping jobs and saving databases...');
  stopJobs();
  saveAllDbs();
  process.exit(0);
});

startServer();
