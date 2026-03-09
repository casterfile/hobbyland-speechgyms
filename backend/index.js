import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Database pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.1' });
});

// GET sessions (history)
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50'
    );
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
    const result = await pool.query(
      `INSERT INTO sessions (
        topic, mode, level, education_level, language, duration_seconds,
        overall_score, sub_scores, transcript, model_answer, wpm,
        filler_word_count, sentiment, structure, speech_framework,
        vocab_upgrades, grammar_analysis, strengths, weaknesses, debate_analysis
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING id, created_at`,
      [
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
    const result = await pool.query(
      `INSERT INTO drills (drill_type, rounds, overall_improvement, next_steps)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [d.type, JSON.stringify(d.rounds), d.overallImprovement, JSON.stringify(d.nextSteps)]
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
