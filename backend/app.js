const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');

const env = require('./config/env');
const xssSanitize = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Trust first proxy (needed for correct client IPs / secure cookies behind a reverse proxy in prod like Render).
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Normalize allowed origins from CLIENT_URL (supports comma-separated, trailing slashes, etc.)
const rawClientUrls = env.clientUrl ? env.clientUrl.split(',') : ['http://localhost:5173'];
const allowedOrigins = rawClientUrls
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, postman, server-to-server) with no origin
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/+$/, '');

    // Direct match with configured origins
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }

    // Allow any Vercel deployment preview or production domain if clientUrl includes vercel.app
    const allowsVercel = allowedOrigins.some((ao) => ao.includes('.vercel.app'));
    if (allowsVercel && /^https:\/\/[a-zA-Z0-9._-]+\.vercel\.app$/.test(normalized)) {
      return callback(null, true);
    }

    // Allow localhost with any port in development
    if (env.nodeEnv !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(normalized)) {
      return callback(null, true);
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-refresh-token'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours preflight cache
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Strips any key starting with '$' or containing '.' from req.body/params/query - blocks NoSQL operator injection.
app.use(mongoSanitize());
// Strips HTML/script content from string fields - blocks stored XSS.
app.use(xssSanitize);

app.use(
  morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MALA ERP API is running', env: env.nodeEnv });
});

// --- Routes mount point ---
// Phase 2+ will add: app.use('/api/auth', require('./routes/auth.routes'));
// Kept as a single mount block here so route registration order stays easy to audit.
app.use('/api', require('./routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
