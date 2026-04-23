const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env from repo root .env or local backend .env
const fs = require('fs');
const rootEnv = path.resolve(__dirname, '..', '.env');
const localEnv = path.resolve(__dirname, '.env');

if (fs.existsSync(rootEnv)) {
  console.log('Loading env from root:', rootEnv);
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(localEnv)) {
  console.log('Loading env from local:', localEnv);
  dotenv.config({ path: localEnv });
} else {
  console.warn('No .env file found at', rootEnv, 'or', localEnv);
}

console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'UNDEFINED');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'loaded' : 'not loaded');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'loaded' : 'not loaded');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'loaded' : 'NOT SET');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS — allow frontend Render URL + localhost
const allowedOrigins = [
  'https://counselling-1.onrender.com',
  'https://counselling-w1mh.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/mood', require('./routes/mood'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
const zoomRouter = require('./routes/zoom');
app.use('/api/zoom', zoomRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Counselling App API is running',
    groq: process.env.GROQ_API_KEY ? 'configured' : 'not configured (fallback active)',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
