import express from 'express';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'speechgyms-secret-key-change-in-prod';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://www.speechgyms.com/api/auth/google/callback';

// Stripe config
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const STRIPE_MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID;
const STRIPE_YEARLY_PRICE_ID = process.env.STRIPE_YEARLY_PRICE_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.speechgyms.com';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Stripe webhook needs raw body — must be BEFORE json parser
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.speechgyms_user_id;
        if (!userId) break;
        await pool.query(
          `UPDATE subscriptions SET status = 'PAID_TRIAL', stripe_subscription_id = $2,
           paid_trial_started_at = NOW(), paid_trial_ends_at = NOW() + INTERVAL '7 days', updated_at = NOW()
           WHERE user_id = $1`,
          [userId, session.subscription]
        );
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const sub = await pool.query('SELECT * FROM subscriptions WHERE stripe_subscription_id = $1', [subscription.id]);
        if (!sub.rows[0]) break;
        const item = subscription.items?.data?.[0];
        const periodStart = item?.current_period_start ? new Date(item.current_period_start * 1000) : null;
        const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

        if (subscription.status === 'active' && !subscription.trial_end) {
          await pool.query(
            `UPDATE subscriptions SET status = 'ACTIVE', current_period_start = $2, current_period_end = $3, updated_at = NOW() WHERE user_id = $1`,
            [sub.rows[0].user_id, periodStart, periodEnd]
          );
        } else if (subscription.status === 'active' && subscription.cancel_at_period_end) {
          await pool.query(
            `UPDATE subscriptions SET status = 'CANCELLED', cancelled_at = NOW(), current_period_end = $2, updated_at = NOW() WHERE user_id = $1`,
            [sub.rows[0].user_id, periodEnd]
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await pool.query(`UPDATE subscriptions SET status = 'EXPIRED', updated_at = NOW() WHERE stripe_subscription_id = $1`, [subscription.id]);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await pool.query(`UPDATE subscriptions SET status = 'PAST_DUE', updated_at = NOW() WHERE stripe_customer_id = $1`, [invoice.customer]);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await pool.query(
          `UPDATE subscriptions SET status = 'ACTIVE', updated_at = NOW() WHERE stripe_customer_id = $1 AND status = 'PAST_DUE'`,
          [invoice.customer]
        );
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

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

// Require auth helper
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
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

    // Ensure subscription record exists
    await pool.query(
      `INSERT INTO subscriptions (user_id, status) VALUES ($1, 'EXPIRED') ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

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

// ==================== SUBSCRIPTION ROUTES ====================

// GET /api/subscription/config - Public
app.get('/api/subscription/config', (req, res) => {
  res.json({
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    monthlyPrice: 9.90,
    yearlyPrice: 59.90,
  });
});

// GET /api/subscription/status
app.get('/api/subscription/status', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.id]);
    const sub = result.rows[0];

    if (!sub) {
      return res.json({
        status: 'EXPIRED', tier: 'free', planInterval: null,
        paidTrialEndsAt: null, currentPeriodEnd: null,
        canAccessFullFeatures: false, requiresUpgrade: true, upgradeReason: 'subscription_required',
      });
    }

    const now = new Date();
    let tier = 'free', canAccessFullFeatures = false, requiresUpgrade = false, upgradeReason = null;

    switch (sub.status) {
      case 'PAID_TRIAL':
        if (sub.paid_trial_ends_at && now > new Date(sub.paid_trial_ends_at)) {
          requiresUpgrade = true; upgradeReason = 'paid_trial_expired';
        } else {
          tier = 'trial'; canAccessFullFeatures = true;
        }
        break;
      case 'ACTIVE':
        tier = 'paid'; canAccessFullFeatures = true;
        break;
      case 'CANCELLED':
        canAccessFullFeatures = sub.current_period_end ? now < new Date(sub.current_period_end) : false;
        if (canAccessFullFeatures) { tier = 'paid'; }
        else { requiresUpgrade = true; upgradeReason = 'subscription_ended'; }
        break;
      case 'EXPIRED':
        requiresUpgrade = true; upgradeReason = 'subscription_expired';
        break;
      case 'PAST_DUE':
        requiresUpgrade = true; upgradeReason = 'payment_failed';
        break;
    }

    res.json({
      status: sub.status, tier, planInterval: sub.plan_interval,
      paidTrialEndsAt: sub.paid_trial_ends_at, currentPeriodEnd: sub.current_period_end,
      canAccessFullFeatures, requiresUpgrade, upgradeReason,
    });
  } catch (err) {
    console.error('GET /api/subscription/status error:', err);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// POST /api/subscription/checkout
app.post('/api/subscription/checkout', requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const { planInterval } = req.body;
    if (!planInterval || !['monthly', 'yearly'].includes(planInterval)) {
      return res.status(400).json({ error: 'planInterval must be "monthly" or "yearly"' });
    }

    // Get user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get or create subscription record
    let subResult = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.id]);
    let sub = subResult.rows[0];
    if (!sub) {
      await pool.query('INSERT INTO subscriptions (user_id, status) VALUES ($1, $2)', [req.user.id, 'EXPIRED']);
      subResult = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.id]);
      sub = subResult.rows[0];
    }

    // Create Stripe customer if needed
    if (!sub.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { speechgyms_user_id: String(req.user.id) },
      });
      await pool.query(
        `UPDATE subscriptions SET stripe_customer_id = $2, plan_interval = $3, updated_at = NOW() WHERE user_id = $1`,
        [req.user.id, customer.id, planInterval.toUpperCase()]
      );
      sub.stripe_customer_id = customer.id;
    }

    const priceId = planInterval === 'monthly' ? STRIPE_MONTHLY_PRICE_ID : STRIPE_YEARLY_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      customer: sub.stripe_customer_id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { speechgyms_user_id: String(req.user.id) },
      },
      success_url: `${FRONTEND_URL}/?subscription=success`,
      cancel_url: `${FRONTEND_URL}/?subscription=cancelled`,
      metadata: { speechgyms_user_id: String(req.user.id) },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/subscription/checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/subscription/portal
app.post('/api/subscription/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const subResult = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.id]);
    const sub = subResult.rows[0];
    if (!sub || !sub.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/subscription/portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.2' });
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
  console.log(`SpeechGyms backend v1.0.2 running on port ${PORT}`);
});
