import { HistoryItem } from '../types';
import { getAuthHeaders } from './authService';

const API_BASE = '/api';
const PENDING_KEY = 'speechgyms_pending_saves';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

const buildPayload = (item: HistoryItem) => ({
  topic: item.topic,
  mode: item.mode,
  level: item.fullResult?.subScores ? 'ADVANCED' : 'BEGINNER',
  educationLevel: 'UNIVERSITY',
  language: 'English',
  durationSeconds: 0,
  overallScore: item.fullResult.overallScore,
  subScores: item.fullResult.subScores,
  transcript: item.fullResult.transcript,
  modelAnswer: item.fullResult.modelAnswer,
  wpm: item.fullResult.wpm,
  fillerWordCount: item.fullResult.fillerWordCount,
  sentiment: item.fullResult.sentiment,
  structure: item.fullResult.structure,
  speechFramework: item.fullResult.speechFramework,
  vocabUpgrades: item.fullResult.vocabUpgrades,
  grammarAnalysis: item.fullResult.grammarAnalysis,
  strengths: item.fullResult.strengths,
  weaknesses: item.fullResult.weaknesses,
  debateAnalysis: item.fullResult.debateAnalysis
});

const readPending = (): HistoryItem[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
};

const writePending = (items: HistoryItem[]) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
};

const postOnce = async (item: HistoryItem): Promise<void> => {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(buildPayload(item))
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
  }
};

const flushPending = async (): Promise<void> => {
  const queue = readPending();
  if (queue.length === 0) return;
  const remaining: HistoryItem[] = [];
  for (const it of queue) {
    try {
      await postOnce(it);
    } catch {
      remaining.push(it);
    }
  }
  writePending(remaining);
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  // Best-effort: try to drain anything we couldn't save earlier so the list
  // the user is about to see actually reflects their work.
  await flushPending().catch(() => {});
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const saveHistoryItem = async (item: HistoryItem): Promise<SaveResult> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await postOnce(item);
      return { ok: true };
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise(r => setTimeout(r, 800));
    }
  }
  // Persist for a future flush so the session isn't lost.
  const queue = readPending();
  queue.push(item);
  writePending(queue);
  console.error("Failed to save history", lastErr);
  return { ok: false, error: lastErr instanceof Error ? lastErr.message : 'Save failed' };
};

export const retryPendingSaves = async (): Promise<SaveResult> => {
  await flushPending();
  const remaining = readPending();
  if (remaining.length === 0) return { ok: true };
  return { ok: false, error: `${remaining.length} session(s) still pending` };
};

export const hasPendingSaves = (): boolean => readPending().length > 0;
