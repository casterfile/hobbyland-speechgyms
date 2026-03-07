
export enum AppStep {
  ONBOARDING = 'ONBOARDING',
  HOME = 'HOME',
  SETUP = 'SETUP',
  STAGE = 'STAGE',
  ANALYSIS = 'ANALYSIS',
  DRILL = 'DRILL',
  DEBATE_SESSION = 'DEBATE_SESSION'
}

export enum SessionMode {
  SPEECH = 'SPEECH',
  EXPRESS = 'EXPRESS',
  COMEDY = 'COMEDY',
  DEBATE = 'DEBATE'
}

export enum SpeechLevel {
  BEGINNER = 'BEGINNER',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export enum EducationLevel {
  ELEMENTARY = 'ELEMENTARY',
  MIDDLE_SCHOOL = 'MIDDLE_SCHOOL',
  HIGH_SCHOOL = 'HIGH_SCHOOL',
  UNIVERSITY = 'UNIVERSITY'
}

export enum DrillType {
  LOGIC = 'LOGIC',       // Connect unrelated words
  FLOW = 'FLOW',         // Anti-filler, pacing focus
  CONTENT = 'CONTENT',   // Rapid fire, zero prep
  IMPACT = 'IMPACT'      // Metaphors and emotion
}

export interface UserPreferences {
  topics: string[];
  preferredMode: SessionMode;
}

export interface SessionConfig {
  topic: string;
  durationSeconds: number;
  language: string;
  mode: SessionMode;
  level: SpeechLevel;
  educationLevel: EducationLevel;
  prepTimeSeconds: number;
  debateSide?: 'AFFIRMATIVE' | 'NEGATIVE';
}

export interface AnalysisResult {
  overallScore: number;
  subScores: {
    logic: number;
    delivery: number;
    structure: number;
    vocabulary: number;
    emotion: number;
  };
  transcript: string;
  modelAnswer: string;
  wpm: number;
  fillerWordCount: number;
  structure: {
    isPrep: boolean;
    point: string;
    reason: string;
    example: string;
    pointRestated: string;
    feedback: string;
  };
  sentiment: string;
  speechFramework: Array<{
    name: string;
    description: string;
    polishedScript: string;
  }>;
  vocabUpgrades: Array<{
    original: string;
    suggested: string;
    type: 'vocabulary' | 'transition';
    tip: string;
  }>;
  grammarAnalysis: Array<{
    original: string;
    correction: string;
    reason: string;
  }>;
  improvements: Array<{
    original: string;
    suggestion: string;
    reason: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  debateAnalysis?: {
    constructive: { transcript: string; modelAnswer: string };
    rebuttal: { transcript: string; modelAnswer: string };
  };
}

export interface HistoryItem {
  id: string;
  date: string;
  topic: string;
  mode: SessionMode;
  score: number;
  wpm: number;
  sentiment: string;
  fullResult: AnalysisResult; 
}

export interface TopicOutline {
  centralIdea: string;
  points: string[];
}

export interface DrillRoundResult {
  round: number;
  prompt: string;
  transcript: string;
  score: number;
  logicFeedback: string;
  polishedVersion: string; 
  keyTransitions: string[]; 
  vocabUpgrades: Array<{
    original: string;
    suggested: string;
    type: 'vocabulary' | 'transition';
    tip: string;
  }>;
}

export interface DrillBatchResult {
  type: DrillType;
  overallImprovement: string;
  rounds: DrillRoundResult[];
  nextSteps: string[];
}

export type Chat = any;
