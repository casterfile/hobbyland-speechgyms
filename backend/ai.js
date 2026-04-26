// AI proxy routes — all live on the backend so provider keys never reach the
// browser bundle. Mirror of the slayjobs architecture: Claude for text,
// Web Speech API in the browser for transcription, Claude for analysis on
// the resulting transcript. No Gemini, no OpenRouter, no third-party audio API.

import Anthropic from '@anthropic-ai/sdk';

const primaryKey = process.env.ANTHROPIC_API_KEY || '';
const fallbackKey = process.env.ANTHROPIC_API_KEY_FALLBACK || '';

const primaryClient = primaryKey ? new Anthropic({ apiKey: primaryKey }) : null;
const fallbackClient = fallbackKey ? new Anthropic({ apiKey: fallbackKey }) : null;

const TEXT_MODEL = 'claude-sonnet-4-6';
const FAST_MODEL = 'claude-haiku-4-5';

function joinTextBlocks(content) {
  return (content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function runClaude({ model, system, messages, maxTokens = 4096, cacheSystem = false }) {
  if (!primaryClient) throw new Error('ANTHROPIC_API_KEY not configured on server');
  const sys = cacheSystem
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : system;
  const call = async (client) => {
    const resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: sys,
      messages,
    });
    return joinTextBlocks(resp.content);
  };
  try {
    return await call(primaryClient);
  } catch (err) {
    const status = err?.status;
    if ((status === 429 || status >= 500) && fallbackClient) {
      console.warn('[anthropic] primary failed, rotating to fallback');
      return await call(fallbackClient);
    }
    throw err;
  }
}

function parseJson(text) {
  if (!text) return {};
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = cleaned.search(/[{\[]/);
  if (first === -1) return {};
  const open = cleaned[first];
  const close = open === '{' ? '}' : ']';
  const last = cleaned.lastIndexOf(close);
  if (last === -1) return {};
  try {
    return JSON.parse(cleaned.slice(first, last + 1));
  } catch (e) {
    console.error('[anthropic] JSON parse failed. Raw:', text.slice(0, 300));
    return {};
  }
}

const EDU = {
  ELEMENTARY: { target: '7-9 year old child', vocab: 'Simple words like happy, play, school, friend. No abstract nouns.' },
  MIDDLE_SCHOOL: { target: '11-13 year old', vocab: 'Standard daily English with words like impact, community.' },
  HIGH_SCHOOL: { target: '14-17 year old', vocab: 'Academic vocabulary including consequently, infrastructure, ethics.' },
  UNIVERSITY: { target: 'Adult/Professional', vocab: 'Sophisticated, nuanced, technical vocabulary.' },
};

const eduConfig = (level) => EDU[level] || EDU.UNIVERSITY;

const JSON_ONLY = '\n\nRespond with ONLY a JSON object/array. No preamble, no markdown fences. Start with { or [.';

// Mount /api/ai/* on the given Express app, after auth middleware.
export function registerAIRoutes(app) {
  // POST /api/ai/topic
  app.post('/api/ai/topic', async (req, res) => {
    try {
      const { interests = [], goal = '', language = 'English', mode = 'IMPROMPTU', level = 'INTERMEDIATE', eduLevel = 'UNIVERSITY' } = req.body || {};
      const cfg = eduConfig(eduLevel);
      const prompt = `Generate exactly 1 impromptu speech topic for a ${cfg.target}. Length: 5-12 words. Simple language.
Topic Interests: ${interests.join(', ') || 'general'}. Goal: ${goal}. Mode: ${mode}. Language: ${language}.
Output ONLY the topic text, no quotes, no preamble.`;
      const text = await runClaude({
        model: FAST_MODEL,
        system: 'You generate concise speech topics. Output only the requested text, nothing else.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 100,
      });
      res.json({ topic: text.trim().replace(/^["']|["']$/g, '') || 'The Importance of Friendship' });
    } catch (e) {
      console.error('[ai] topic error:', e?.message || e);
      res.status(500).json({ error: 'Failed to generate topic', topic: 'The Importance of Friendship' });
    }
  });

  // POST /api/ai/drill-challenges
  app.post('/api/ai/drill-challenges', async (req, res) => {
    try {
      const { type = 'LOGIC', count = 3, language = 'English', contextTopic = '', eduLevel = 'UNIVERSITY' } = req.body || {};
      const cfg = eduConfig(eduLevel);
      const prompt = `Generate ${count} drill challenges for a ${cfg.target}. Type: ${type}. Context: ${contextTopic}.
Constraint: 5-12 words per challenge. Simple wording.
Language: ${language}. Output as a JSON array of strings.${JSON_ONLY}`;
      const text = await runClaude({
        model: FAST_MODEL,
        system: 'You generate short speech-drill prompts. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
      });
      const parsed = parseJson(text);
      res.json({ prompts: Array.isArray(parsed) ? parsed : (Array.isArray(parsed.prompts) ? parsed.prompts : []) });
    } catch (e) {
      console.error('[ai] drill-challenges error:', e?.message || e);
      res.status(500).json({ error: 'Failed', prompts: [] });
    }
  });

  // POST /api/ai/analyze-speech — transcript-based (Web Speech API on the client)
  app.post('/api/ai/analyze-speech', async (req, res) => {
    try {
      const { transcript = '', topic = '', duration = 0, mode = 'IMPROMPTU', language = 'English', level = 'INTERMEDIATE', eduLevel = 'UNIVERSITY' } = req.body || {};
      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ error: 'transcript is required' });
      }
      const cfg = eduConfig(eduLevel);
      const prompt = `You are a world-class Speech Coach and Rhetoric Professor evaluating a ${cfg.target}.
Topic: "${topic}". Language: ${language}. Duration: ~${Math.round(duration)}s. Mode: ${mode}. Level: ${level}.

CANDIDATE'S SPOKEN TRANSCRIPT (transcribed live in the browser):
${transcript}

EVALUATION CRITERIA (be rigorous and specific):

1. transcript: Echo the transcript above EXACTLY as the "transcript" field.
2. overallScore (0-100): Be strict. 70+ = genuinely good. 50-69 = average. <50 = needs work.
3. subScores (each 0-100): logic, delivery, structure, vocabulary, emotion.
   - delivery: infer from pacing/repetition/filler density (cannot hear audio).
4. modelAnswer: Write a complete polished 200-300 word model speech for this topic. Strong hook, 2-3 body points with evidence, memorable conclusion. Use rhetorical devices.
5. structure: { isPrep (boolean), feedback (2-3 sentences), point, reason, example, pointRestated }
6. vocabUpgrades: 8-15 items, each { original, suggested, type ("vocabulary"|"transition"), tip }
7. speechFramework: 2-3 alternative framework scripts, each { name, description, polishedScript (150-250 words) }
8. grammarAnalysis: every grammar issue, each { original, correction, reason }
9. strengths: 3-5 specific concrete strengths (cite quotes from transcript).
10. weaknesses: 3-5 specific actionable weaknesses.
11. sentiment: brief emotional tone description.
12. fillerWordCount: count of um/uh/like/you know/so/basically/I mean/right.

If transcript is empty or "[No speech detected]", return overallScore 0 but still produce ALL fields with ideal examples.

Output ONLY the JSON object with these top-level keys: overallScore, subScores, transcript, modelAnswer, vocabUpgrades, structure, speechFramework, grammarAnalysis, strengths, weaknesses, sentiment, fillerWordCount.${JSON_ONLY}`;
      const text = await runClaude({
        model: TEXT_MODEL,
        system: 'You are an expert speech coach. Return only valid JSON matching the requested schema.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 6144,
      });
      const r = parseJson(text);
      res.json({
        overallScore: r.overallScore || 0,
        subScores: r.subScores || { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 },
        transcript: r.transcript || transcript,
        modelAnswer: r.modelAnswer || '',
        vocabUpgrades: r.vocabUpgrades || [],
        fillerWordCount: r.fillerWordCount || 0,
        structure: r.structure || { isPrep: false, feedback: 'No analysis available.', point: '', reason: '', example: '', pointRestated: '' },
        sentiment: r.sentiment || 'Neutral',
        speechFramework: r.speechFramework || [],
        grammarAnalysis: r.grammarAnalysis || [],
        strengths: r.strengths || [],
        weaknesses: r.weaknesses || [],
      });
    } catch (e) {
      console.error('[ai] analyze-speech error:', e?.message || e);
      res.status(500).json({ error: 'Analysis failed', message: e?.message });
    }
  });

  // POST /api/ai/debate-counter — generate AI's counter-argument from user's transcript
  app.post('/api/ai/debate-counter', async (req, res) => {
    try {
      const { transcript = '', topic = '', userSide = 'AFFIRMATIVE', language = 'English', eduLevel = 'UNIVERSITY' } = req.body || {};
      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ error: 'transcript is required' });
      }
      const cfg = eduConfig(eduLevel);
      const aiSide = userSide === 'AFFIRMATIVE' ? 'NEGATIVE' : 'AFFIRMATIVE';
      const prompt = `Act as a skilled Debate Opponent for a ${cfg.target}.
Topic: "${topic}". User Side: ${userSide}. Your Side: ${aiSide}. Language: ${language}.

User's constructive speech (transcribed):
"""${transcript}"""

Task: Identify the user's main arguments. Write a sharp, logical 150-word Counter-Statement (Rebuttal) attacking their points and establishing your case. Concise, spoken-style.
Output ONLY the counter-statement text, no preamble.`;
      const text = await runClaude({
        model: FAST_MODEL,
        system: 'You are a skilled debate opponent. Output only the requested counter-statement, nothing else.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
      });
      res.json({ counter: text.trim() });
    } catch (e) {
      console.error('[ai] debate-counter error:', e?.message || e);
      res.status(500).json({ error: 'Failed', counter: 'I disagree with your premise. Let me present a counter-argument.' });
    }
  });

  // POST /api/ai/analyze-debate — two transcripts (constructive + rebuttal)
  app.post('/api/ai/analyze-debate', async (req, res) => {
    try {
      const { constructiveTranscript = '', rebuttalTranscript = '', aiCounterText = '', topic = '', userSide = 'AFFIRMATIVE', language = 'English', eduLevel = 'UNIVERSITY' } = req.body || {};
      if (!constructiveTranscript || !rebuttalTranscript) {
        return res.status(400).json({ error: 'both constructiveTranscript and rebuttalTranscript are required' });
      }
      const cfg = eduConfig(eduLevel);
      const prompt = `You are a Master Debate Judge and Rhetoric Expert evaluating a ${cfg.target}.
Topic: "${topic}". User Side: ${userSide}. Language: ${language}.

User Constructive Speech (transcript):
"""${constructiveTranscript}"""

AI Opponent Counter-Argument:
"""${(aiCounterText || '').slice(0, 1500)}"""

User Rebuttal Speech (transcript):
"""${rebuttalTranscript}"""

EVALUATION (rigorous and detailed):

1. debateAnalysis: { constructive: { transcript, modelAnswer (200-word ideal constructive) }, rebuttal: { transcript, modelAnswer (200-word ideal rebuttal that dismantles opponent) } }
2. overallScore (0-100): strict — argument quality, refutation skill, evidence usage, logical consistency.
3. subScores (each 0-100): logic, delivery, structure, vocabulary, emotion.
4. modelAnswer: combined ideal performance summary (200-300 words).
5. vocabUpgrades: 8-15 items.
6. speechFramework: 2 alternative debate strategies, each { name, description, polishedScript }.
7. grammarAnalysis: every error.
8. strengths: 3-5 specific (cite actual quotes).
9. weaknesses: 3-5 specific actionable.
10. sentiment: e.g. "Assertive in constructive, defensive in rebuttal".

Output ONLY the JSON object with top-level keys: overallScore, subScores, transcript, modelAnswer, vocabUpgrades, structure, speechFramework, grammarAnalysis, strengths, weaknesses, sentiment, fillerWordCount, debateAnalysis.${JSON_ONLY}`;
      const text = await runClaude({
        model: TEXT_MODEL,
        system: 'You are a master debate judge. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 6144,
      });
      const r = parseJson(text);
      res.json({
        overallScore: r.overallScore || 0,
        subScores: r.subScores || { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 },
        transcript: r.transcript || `${constructiveTranscript}\n\n[Rebuttal]\n${rebuttalTranscript}`,
        modelAnswer: r.modelAnswer || '',
        vocabUpgrades: r.vocabUpgrades || [],
        fillerWordCount: r.fillerWordCount || 0,
        structure: r.structure || { isPrep: false, feedback: 'Debate analysis completed.', point: 'Case', reason: 'Logic', example: 'Evidence', pointRestated: 'Conclusion' },
        sentiment: r.sentiment || 'Neutral',
        speechFramework: r.speechFramework || [],
        grammarAnalysis: r.grammarAnalysis || [],
        strengths: r.strengths || [],
        weaknesses: r.weaknesses || [],
        debateAnalysis: r.debateAnalysis,
      });
    } catch (e) {
      console.error('[ai] analyze-debate error:', e?.message || e);
      res.status(500).json({ error: 'Failed', message: e?.message });
    }
  });

  // POST /api/ai/translate
  app.post('/api/ai/translate', async (req, res) => {
    try {
      const { text = '', targetLanguage = 'English' } = req.body || {};
      if (!text) return res.json({ translated: '' });
      const out = await runClaude({
        model: FAST_MODEL,
        system: 'You are a professional translator. Output only the translated text, nothing else.',
        messages: [{ role: 'user', content: `Translate the following text to ${targetLanguage}. Keep the tone professional and educational. Output ONLY the translation.\n\nText: "${text}"` }],
        maxTokens: 1024,
      });
      res.json({ translated: out.trim() || text });
    } catch (e) {
      console.error('[ai] translate error:', e?.message || e);
      res.status(500).json({ error: 'Failed', translated: req.body?.text || '' });
    }
  });

  // POST /api/ai/topic-outline
  app.post('/api/ai/topic-outline', async (req, res) => {
    try {
      const { topic = '', language = 'English', eduLevel = 'UNIVERSITY' } = req.body || {};
      const cfg = eduConfig(eduLevel);
      const prompt = `Generate a mindmap for: "${topic}". Level: ${cfg.target}. Language: ${language}.
Return JSON: {"centralIdea": string, "points": string[]}.${JSON_ONLY}`;
      const text = await runClaude({
        model: FAST_MODEL,
        system: 'You generate mindmap outlines. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
      });
      const r = parseJson(text);
      res.json({ centralIdea: r.centralIdea || topic, points: r.points || ['Part 1', 'Part 2', 'Part 3'] });
    } catch (e) {
      console.error('[ai] topic-outline error:', e?.message || e);
      res.status(500).json({ centralIdea: req.body?.topic || 'Topic', points: ['Part 1', 'Part 2', 'Part 3'] });
    }
  });

  // POST /api/ai/coach-chat — stateless multi-turn chat
  app.post('/api/ai/coach-chat', async (req, res) => {
    try {
      const { systemContext, messages } = req.body || {};
      if (!systemContext || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'systemContext and messages are required' });
      }
      const claudeMessages = messages
        .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: m.content }));
      if (claudeMessages.length === 0 || claudeMessages[0].role !== 'user') {
        return res.status(400).json({ error: 'first message must be user' });
      }
      const text = await runClaude({
        model: TEXT_MODEL,
        system: systemContext,
        messages: claudeMessages,
        maxTokens: 1024,
        cacheSystem: true,
      });
      res.json({ text });
    } catch (e) {
      console.error('[ai] coach-chat error:', e?.message || e);
      res.status(500).json({ error: 'Failed', text: 'Sorry, I lost my connection.' });
    }
  });

  // POST /api/ai/analyze-drill-batch — array of { transcript, prompt }
  app.post('/api/ai/analyze-drill-batch', async (req, res) => {
    try {
      const { recordings = [], type = 'LOGIC', language = 'English', eduLevel = 'UNIVERSITY' } = req.body || {};
      if (!Array.isArray(recordings) || recordings.length === 0) {
        return res.status(400).json({ error: 'recordings array required' });
      }
      const cfg = eduConfig(eduLevel);
      // One Claude call analyzes all rounds together — better context, cheaper.
      const transcriptBlock = recordings.map((r, i) => `Round ${i + 1}\nPrompt: "${r.prompt || ''}"\nTranscript: ${r.transcript || '(silence)'}`).join('\n\n');
      const prompt = `Analyze ${recordings.length} ${type} drill rounds for a ${cfg.target}. Language: ${language}.

${transcriptBlock}

For EACH round provide: { round (int), prompt, transcript, score (1-10), logicFeedback (suggested logic flow with -> arrows; do NOT just repeat what the user said), polishedVersion (improved version), keyTransitions (array), vocabUpgrades: array of { original, suggested, type ("vocabulary"|"transition"), tip } }

Then provide an overallImprovement summary and nextSteps array (2-3 strings).

Output JSON: { rounds: [...], overallImprovement: string, nextSteps: string[] }${JSON_ONLY}`;
      const text = await runClaude({
        model: TEXT_MODEL,
        system: 'You are a world-class speech analyst. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 4096,
      });
      const r = parseJson(text);
      res.json({
        type,
        rounds: Array.isArray(r.rounds) ? r.rounds : [],
        overallImprovement: r.overallImprovement || 'Great effort.',
        nextSteps: Array.isArray(r.nextSteps) ? r.nextSteps : ['Keep practicing'],
      });
    } catch (e) {
      console.error('[ai] analyze-drill-batch error:', e?.message || e);
      res.status(500).json({ error: 'Failed', rounds: [], overallImprovement: 'Analysis unavailable.', nextSteps: [] });
    }
  });
}
