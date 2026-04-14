const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment from repository root .env (server runs from server/)
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'loaded' : 'not loaded');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'loaded' : 'not loaded');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/mood', require('./routes/mood'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/chat', require('./routes/chat'));
const zoomRouter = require('./routes/zoom');
app.use('/api/zoom', zoomRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Counselling App API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
