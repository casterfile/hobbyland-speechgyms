import express from 'express';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'speechgyms-secret-key-change-in-prod';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://www.speechgyms.com/api/auth/google/callback';

app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Database pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auth middleware - extracts user from JWT if present
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // Invalid token, continue without user
    }
  }
  next();
};

app.use(authMiddleware);

// ==================== AUTH ROUTES ====================

// Step 1: Redirect to Google OAuth
app.get('/api/auth/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Step 2: Google callback - exchange code for tokens
app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error('Google token error:', tokens);
      return res.redirect('/?error=token_failed');
    }

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const googleUser = await userRes.json();

    // Upsert user in database
    const result = await pool.query(
      `INSERT INTO users (email, name, avatar_url, auth_provider)
       VALUES ($1, $2, $3, 'google')
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = NOW()
       RETURNING id, email, name, avatar_url`,
      [googleUser.email, googleUser.name, googleUser.picture]
    );

    const user = result.rows[0];

    // Create JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Redirect to frontend with token
    res.redirect(`/?token=${token}`);
  } catch (err) {
    console.error('Google auth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.user);
});

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.1' });
});

// GET sessions (history) - filtered by user if logged in
app.get('/api/sessions', async (req, res) => {
  try {
    const userId = req.user?.id;
    const query = userId
      ? 'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50'
      : 'SELECT * FROM sessions WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50';
    const params = userId ? [userId] : [];
    const result = await pool.query(query, params);
    const sessions = result.rows.map(row => ({
      id: row.id.toString(),
      date: row.created_at,
      topic: row.topic,
      mode: row.mode,
      score: row.overall_score,
      wpm: row.wpm,
      sentiment: row.sentiment,
      fullResult: {
        overallScore: row.overall_score,
        subScores: row.sub_scores,
        transcript: row.transcript,
        modelAnswer: row.model_answer,
        wpm: row.wpm,
        fillerWordCount: row.filler_word_count,
        structure: row.structure,
        sentiment: row.sentiment,
        speechFramework: row.speech_framework,
        vocabUpgrades: row.vocab_upgrades,
        grammarAnalysis: row.grammar_analysis,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        improvements: (row.grammar_analysis || []).map(g => ({
          original: g.original,
          suggestion: g.correction,
          reason: g.reason
        })),
        debateAnalysis: row.debate_analysis
      }
    }));
    res.json(sessions);
  } catch (err) {
    console.error('GET /api/sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST session
app.post('/api/sessions', async (req, res) => {
  try {
    const s = req.body;
    const userId = req.user?.id || null;
    const result = await pool.query(
      `INSERT INTO sessions (
        user_id, topic, mode, level, education_level, language, duration_seconds,
        overall_score, sub_scores, transcript, model_answer, wpm,
        filler_word_count, sentiment, structure, speech_framework,
        vocab_upgrades, grammar_analysis, strengths, weaknesses, debate_analysis
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING id, created_at`,
      [
        userId,
        s.topic, s.mode, s.level, s.educationLevel, s.language, s.durationSeconds,
        s.overallScore, JSON.stringify(s.subScores), s.transcript, s.modelAnswer, s.wpm,
        s.fillerWordCount, s.sentiment, JSON.stringify(s.structure), JSON.stringify(s.speechFramework),
        JSON.stringify(s.vocabUpgrades), JSON.stringify(s.grammarAnalysis),
        JSON.stringify(s.strengths), JSON.stringify(s.weaknesses),
        s.debateAnalysis ? JSON.stringify(s.debateAnalysis) : null
      ]
    );
    res.json({ id: result.rows[0].id, date: result.rows[0].created_at });
  } catch (err) {
    console.error('POST /api/sessions error:', err);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// POST drill
app.post('/api/drills', async (req, res) => {
  try {
    const d = req.body;
    const userId = req.user?.id || null;
    const result = await pool.query(
      `INSERT INTO drills (user_id, drill_type, rounds, overall_improvement, next_steps)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [userId, d.type, JSON.stringify(d.rounds), d.overallImprovement, JSON.stringify(d.nextSteps)]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('POST /api/drills error:', err);
    res.status(500).json({ error: 'Failed to save drill' });
  }
});

// POST chat log
app.post('/api/chats', async (req, res) => {
  try {
    const { sessionId, topic, messages } = req.body;
    const result = await pool.query(
      `INSERT INTO chat_logs (session_id, topic, messages)
       VALUES ($1, $2, $3) RETURNING id`,
      [sessionId || null, topic, JSON.stringify(messages)]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('POST /api/chats error:', err);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SpeechGyms backend v1.0.1 running on port ${PORT}`);
});
