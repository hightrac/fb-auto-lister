require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SECRET = process.env.JWT_SECRET;

// Create tables if they don't exist
app.use(async (req, res, next) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        api_key TEXT,
        plan TEXT
      );
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action TEXT,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS daily_posts (
        user_id INTEGER PRIMARY KEY,
        post_date DATE DEFAULT CURRENT_DATE,
        count INTEGER DEFAULT 0,
        last_post_at TIMESTAMP,
        UNIQUE(user_id, post_date)
      );
    `);
    next();
  } catch (err) { next(err); }
});

// Register
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, password]);
  res.send('Registered');
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
  if (rows.length) {
    const token = jwt.sign({ id: rows[0].id }, SECRET);
    res.json({ token });
  } else res.status(401).send('Invalid');
});

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    jwt.verify(token, SECRET, (err, user) => {
      if (err) return res.status(403).send('Invalid token');
      req.user = user;
      next();
    });
  } else res.status(401).send('No token');
}

// Log activity with rate limiting
app.post('/activities/log', authenticate, async (req, res) => {
  const { action, details } = req.body;
  if (action === 'post') {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const { rows } = await pool.query(
      `INSERT INTO daily_posts (user_id, post_date, count, last_post_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (user_id, post_date) DO UPDATE
       SET count = daily_posts.count + 1, last_post_at = $3
       RETURNING count, last_post_at`,
      [req.user.id, today, now]
    );

    const { count, last_post_at } = rows[0];
    if (count > 10) {
      return res.status(429).json({ error: 'Daily limit of 10 posts reached' });
    }
    if (last_post_at) {
      const minutesSince = (now - new Date(last_post_at)) / 60000;
      if (minutesSince < 2) {
        return res.status(429).json({
          error: 'Rate limited',
          wait_minutes: Math.ceil(2 - minutesSince)
        });
      }
    }
  }

  await pool.query('INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, action, details]);
  res.send('Logged');
});

app.get('/api/queue-status', authenticate, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    'SELECT count, last_post_at FROM daily_posts WHERE user_id = $1 AND post_date = $2',
    [req.user.id, today]
  );
  res.json({
    posts_today: rows[0]?.count || 0,
    last_post: rows[0]?.last_post_at,
    can_post: !rows[0] || rows[0].count < 10
  });
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));
