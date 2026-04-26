// NOTE: filename kept as geminiService.ts for backwards-compat with existing
// imports, but it no longer talks to Gemini. All AI calls now route through
// the backend at /api/ai/* which proxies to Anthropic Claude. Provider keys
// live on the server, never in the browser bundle.

import { AnalysisResult, SessionMode, SpeechLevel, EducationLevel, TopicOutline, DrillType, DrillBatchResult } from "../types";

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api/ai'
    : '/api/ai';

async function aiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `AI request failed (${res.status})`);
  }
  return data as T;
}

export const generateTopic = async (
  interests: string[],
  goal: string,
  language: string,
  mode: SessionMode,
  level: SpeechLevel,
  eduLevel: EducationLevel
): Promise<string> => {
  try {
    const { topic } = await aiPost<{ topic: string }>('/topic', { interests, goal, language, mode, level, eduLevel });
    return topic || 'The Importance of Friendship';
  } catch (e) {
    console.error(e);
    return 'The Importance of Friendship';
  }
};

export const generateDrillChallenges = async (
  type: DrillType,
  count: number,
  language: string,
  contextTopic: string,
  eduLevel: EducationLevel
): Promise<string[]> => {
  try {
    const { prompts } = await aiPost<{ prompts: string[] }>('/drill-challenges', { type, count, language, contextTopic, eduLevel });
    return Array.isArray(prompts) ? prompts : [];
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const analyzeSpeech = async (
  _audioBlob: Blob,
  topic: string,
  duration: number,
  mode: SessionMode,
  language: string,
  level: SpeechLevel,
  eduLevel: EducationLevel,
  liveTranscript?: string,
): Promise<AnalysisResult> => {
  try {
    const result = await aiPost<AnalysisResult>('/analyze-speech', {
      transcript: liveTranscript || '',
      topic,
      duration,
      mode,
      language,
      level,
      eduLevel,
    });
    // Compute WPM client-side from the transcript Claude echoed back.
    const transcript = result.transcript || liveTranscript || '';
    const isCjk = language.toLowerCase().includes('chinese') || language.toLowerCase().includes('cantonese') || language.toLowerCase().includes('mandarin');
    const unitCount = isCjk ? transcript.length : transcript.trim().split(/\s+/).filter(Boolean).length;
    const wpm = Math.round((unitCount / Math.max(duration, 1)) * 60) || 0;
    const improvements = (result.grammarAnalysis || []).map((g: any) => ({
      original: g.original,
      suggestion: g.correction,
      reason: g.reason,
    }));
    return { ...result, wpm, improvements } as AnalysisResult;
  } catch (e) {
    console.error('analyzeSpeech failed:', e);
    return {
      overallScore: 0,
      subScores: { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 },
      transcript: liveTranscript || '',
      modelAnswer: 'Analysis unavailable. Please try again.',
      vocabUpgrades: [],
      fillerWordCount: 0,
      structure: { isPrep: false, feedback: 'Analysis unavailable.', point: '', reason: '', example: '', pointRestated: '' },
      sentiment: 'Unknown',
      speechFramework: [],
      grammarAnalysis: [],
      strengths: [],
      weaknesses: [],
      wpm: 0,
      improvements: [],
    } as AnalysisResult;
  }
};

export const generateDebateCounter = async (
  _userBlob: Blob,
  topic: string,
  userSide: string,
  language: string,
  eduLevel: EducationLevel,
  liveTranscript?: string,
): Promise<string> => {
  try {
    const { counter } = await aiPost<{ counter: string }>('/debate-counter', {
      transcript: liveTranscript || '',
      topic,
      userSide,
      language,
      eduLevel,
    });
    return counter || 'I disagree with your premise. Let me present a counter-argument.';
  } catch (e) {
    console.error(e);
    return 'I disagree with your premise. Let me present a counter-argument.';
  }
};

export const analyzeDebateSession = async (
  _constructiveBlob: Blob,
  _rebuttalBlob: Blob,
  aiCounterText: string,
  topic: string,
  userSide: string,
  language: string,
  eduLevel: EducationLevel,
  constructiveTranscript?: string,
  rebuttalTranscript?: string,
): Promise<AnalysisResult> => {
  try {
    const result = await aiPost<AnalysisResult>('/analyze-debate', {
      constructiveTranscript: constructiveTranscript || '',
      rebuttalTranscript: rebuttalTranscript || '',
      aiCounterText,
      topic,
      userSide,
      language,
      eduLevel,
    });
    return { ...result, wpm: 0, improvements: [] } as AnalysisResult;
  } catch (e) {
    console.error('analyzeDebateSession failed:', e);
    return {
      overallScore: 0,
      subScores: { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 },
      transcript: '',
      modelAnswer: 'Debate analysis unavailable.',
      vocabUpgrades: [],
      fillerWordCount: 0,
      structure: { isPrep: false, feedback: 'Analysis unavailable.', point: '', reason: '', example: '', pointRestated: '' },
      sentiment: 'Unknown',
      speechFramework: [],
      grammarAnalysis: [],
      strengths: [],
      weaknesses: [],
      wpm: 0,
      improvements: [],
    } as AnalysisResult;
  }
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  if (!text) return '';
  try {
    const { translated } = await aiPost<{ translated: string }>('/translate', { text, targetLanguage });
    return translated || text;
  } catch {
    return text;
  }
};

export const generateTopicOutline = async (
  topic: string,
  language: string,
  eduLevel: EducationLevel
): Promise<TopicOutline> => {
  try {
    const r = await aiPost<{ centralIdea: string; points: string[] }>('/topic-outline', { topic, language, eduLevel });
    return { centralIdea: r.centralIdea || topic, points: r.points || [] };
  } catch {
    return { centralIdea: topic, points: ['Part 1', 'Part 2', 'Part 3'] };
  }
};

// Mimic the previous Gemini "chat session" interface: chat.sendMessage({message}) → { text }.
// Internally maintains the message history and sends it on each call.
export interface CoachChatSession {
  sendMessage(args: { message: string }): Promise<{ text: string }>;
}

export const createCoachChat = (
  result: AnalysisResult,
  topic: string,
  mode: SessionMode,
  language: string,
  eduLevel: EducationLevel
): CoachChatSession => {
  const systemContext = `You are an AI Speech Coach for a ${eduLevel}-level speaker.
The user just completed a ${mode} session on the topic "${topic}".
Their performance scores were: overall ${result.overallScore}, logic ${result.subScores?.logic ?? '?'}, delivery ${result.subScores?.delivery ?? '?'}, structure ${result.subScores?.structure ?? '?'}.
Their transcript was: "${result.transcript ?? ''}".
Be encouraging, specific, and use age-appropriate language. Keep responses concise and conversational in ${language}.`;

  const history: { role: 'user' | 'assistant'; content: string }[] = [];

  return {
    async sendMessage({ message }) {
      history.push({ role: 'user', content: message });
      try {
        const { text } = await aiPost<{ text: string }>('/coach-chat', { systemContext, messages: history });
        history.push({ role: 'assistant', content: text });
        return { text };
      } catch (e) {
        history.pop();
        throw e;
      }
    },
  };
};

export const analyzeDrillBatch = async (
  recordings: { blob: Blob; prompt: string; transcript?: string }[],
  type: DrillType,
  language: string,
  eduLevel: EducationLevel
): Promise<DrillBatchResult> => {
  try {
    const payload = recordings.map((r) => ({ transcript: r.transcript || '', prompt: r.prompt }));
    const { rounds, overallImprovement, nextSteps } = await aiPost<DrillBatchResult>('/analyze-drill-batch', {
      recordings: payload,
      type,
      language,
      eduLevel,
    });
    return { type, rounds: rounds || [], overallImprovement: overallImprovement || '', nextSteps: nextSteps || [] };
  } catch (e) {
    console.error(e);
    return {
      type,
      rounds: recordings.map((r, i) => ({
        round: i + 1,
        prompt: r.prompt,
        transcript: r.transcript || '',
        score: 0,
        logicFeedback: 'Analysis unavailable.',
        polishedVersion: '',
        keyTransitions: [],
        vocabUpgrades: [],
      })),
      overallImprovement: 'Analysis unavailable.',
      nextSteps: ['Try again later'],
    };
  }
};
