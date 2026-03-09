
import { HistoryItem } from '../types';
import { getAuthHeaders } from './authService';

const API_BASE = '/api';

export const getHistory = async (): Promise<HistoryItem[]> => {
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

export const saveHistoryItem = async (item: HistoryItem) => {
  try {
    const payload = {
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
    };
    await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Failed to save history", e);
  }
};
