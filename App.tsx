
import React, { useState, useEffect } from 'react';
import { AppStep, UserPreferences, SessionConfig, AnalysisResult, SessionMode, HistoryItem, SpeechLevel, DrillType, EducationLevel } from './types';
import { SessionSetup } from './components/SessionSetup';
import { Stage } from './components/Stage';
import { Analysis } from './components/Analysis';
import { Home } from './components/Home';
import { DrillSession } from './components/DrillSession';
import { DebateSession } from './components/DebateSession';
import { analyzeSpeech, analyzeDebateSession } from './services/geminiService';
import { saveHistoryItem } from './services/historyService';
import { User, getCurrentUser, handleAuthCallback, loginWithGoogle, logout } from './services/authService';

const SPEECH_TIPS = [
  "Pause for 2-3 seconds before answering to show thoughtfulness.",
  "Use the PREP method: Point, Reason, Example, Point.",
  "Maintain eye contact with the camera to simulate audience connection.",
  "Vary your vocal tone to keep the audience engaged.",
  "Avoid filler words like 'um' and 'ah' by pausing instead.",
  "Start with a hook: a story, a statistic, or a question.",
  "End with a call to action or a memorable closing statement.",
  "Use hand gestures naturally to emphasize key points.",
  "Speak slightly slower than your normal conversation speed.",
  "Structure your speech with a clear beginning, middle, and end.",
  "Use 'Rule of Three' for lists (e.g., 'Life, Liberty, and Pursuit of Happiness').",
  "Smile when appropriate; it changes the tone of your voice.",
  "Anchor your body; avoid swaying or pacing aimlessly.",
  "Use analogies to explain complex concepts.",
  "Address the audience directly using 'you'.",
  "If you stumble, just pause, smile, and continue.",
  "Use silence as a tool to let important points sink in.",
  "Articulate your words clearly, especially consonants.",
  "Check your lighting; ensure your face is clearly visible.",
  "Breath from your diaphragm to project confidence.",
  "Don't memorize; internalize the key points instead.",
  "Visualize a successful speech before you start.",
  "Use a 'Past, Present, Future' structure for storytelling.",
  "Turn nervous energy into enthusiasm.",
  "Keep your sentences relatively short and punchy.",
  "Ask rhetorical questions to engage the audience's mind.",
  "Use contrast (e.g., 'Not only X, but also Y').",
  "Acknowledge the counter-argument to build credibility.",
  "Record yourself often to identify subconscious habits.",
  "Be yourself; authenticity resonates more than perfection."
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    handleAuthCallback();
    getCurrentUser().then(user => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
  }, []);

  const [step, setStep] = useState<AppStep>(AppStep.HOME);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>({ topics: [], preferredMode: SessionMode.SPEECH });
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ 
    topic: '', 
    durationSeconds: 60, 
    language: 'English', 
    mode: SessionMode.SPEECH, 
    level: SpeechLevel.BEGINNER, 
    educationLevel: EducationLevel.UNIVERSITY,
    prepTimeSeconds: 0 
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTips, setActiveTips] = useState<string[]>([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  
  const [activeDrillType, setActiveDrillType] = useState<DrillType>(DrillType.LOGIC);

  const handleGoHome = () => {
    setAnalysisResult(null);
    setCurrentAudioBlob(null);
    setAnalysisError(false);
    setStep(AppStep.HOME);
  };

  const handleStartSessionFromHome = (mode?: SessionMode) => {
      if (mode) setSessionConfig(prev => ({ ...prev, mode }));
      setStep(AppStep.SETUP);
  };

  const handleSessionStart = (config: SessionConfig) => {
    setSessionConfig(config);
    if (config.mode === SessionMode.DEBATE) {
      setStep(AppStep.DEBATE_SESSION);
    } else {
      setStep(AppStep.STAGE);
    }
  };

  const handleStartDrill = (type: DrillType) => {
      setActiveDrillType(type);
      setStep(AppStep.DRILL);
  };

  const handleViewSession = (item: HistoryItem) => {
    setSessionConfig({ 
      topic: item.topic, 
      mode: item.mode, 
      durationSeconds: 0, 
      language: 'English', 
      level: SpeechLevel.BEGINNER, 
      educationLevel: EducationLevel.UNIVERSITY,
      prepTimeSeconds: 0 
    });
    setAnalysisResult(item.fullResult);
    setStep(AppStep.ANALYSIS);
  };

  useEffect(() => {
    if (isAnalyzing) {
      const shuffled = [...SPEECH_TIPS].sort(() => 0.5 - Math.random());
      setActiveTips(shuffled.slice(0, 5));
      setCurrentTipIndex(0);
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (isAnalyzing && activeTips.length > 0) {
      const interval = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % activeTips.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, activeTips]);

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => prev >= 99 ? 99 : prev + 0.5);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleSessionFinish = async (audioBlob: Blob, duration: number) => {
    setIsAnalyzing(true);
    setAnalysisError(false);
    setCurrentAudioBlob(audioBlob);
    setRecordedDuration(duration);
    try {
      const result = await analyzeSpeech(
        audioBlob, 
        sessionConfig.topic, 
        duration, 
        sessionConfig.mode, 
        sessionConfig.language, 
        sessionConfig.level,
        sessionConfig.educationLevel
      );
      setAnalysisResult(result);
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        topic: sessionConfig.topic,
        mode: sessionConfig.mode,
        score: result.overallScore,
        wpm: result.wpm,
        sentiment: result.sentiment,
        fullResult: result 
      };
      await saveHistoryItem(historyItem);
      setIsAnalyzing(false);
      setStep(AppStep.ANALYSIS);
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
      setAnalysisError(true);
    }
  };

  const handleDebateFinish = async (constructiveBlob: Blob, rebuttalBlob: Blob, aiCounter: string) => {
    setIsAnalyzing(true);
    setAnalysisError(false);
    setCurrentAudioBlob(rebuttalBlob); // We use the final rebuttal as the main audio for review
    setRecordedDuration(sessionConfig.durationSeconds); // Approximate
    try {
      const result = await analyzeDebateSession(
        constructiveBlob,
        rebuttalBlob,
        aiCounter,
        sessionConfig.topic,
        sessionConfig.debateSide || 'AFFIRMATIVE',
        sessionConfig.language,
        sessionConfig.educationLevel
      );
      setAnalysisResult(result);
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        topic: sessionConfig.topic,
        mode: sessionConfig.mode,
        score: result.overallScore,
        wpm: result.wpm,
        sentiment: result.sentiment,
        fullResult: result 
      };
      await saveHistoryItem(historyItem);
      setIsAnalyzing(false);
      setStep(AppStep.ANALYSIS);
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
      setAnalysisError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000 ${sessionConfig.mode === SessionMode.SPEECH ? 'bg-blue-900/20' : 'bg-rose-900/20'}`}></div>
         <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000 ${sessionConfig.mode === SessionMode.SPEECH ? 'bg-teal-900/20' : 'bg-purple-900/20'}`}></div>
      </div>
      <div className="relative z-10">
        {/* Auth UI - top right */}
        <div className="fixed top-4 right-4 z-50">
          {authLoading ? null : currentUser ? (
            <div className="flex items-center gap-3">
              <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-full border-2 border-slate-600" referrerPolicy="no-referrer" />
              <span className="text-sm text-slate-300 hidden md:block">{currentUser.name}</span>
              <button onClick={logout} className="text-xs text-slate-500 hover:text-white transition-colors">Logout</button>
            </div>
          ) : (
            <button onClick={loginWithGoogle} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign in with Google
            </button>
          )}
        </div>

        {step === AppStep.HOME && <Home prefs={userPrefs} onStartSession={handleStartSessionFromHome} onViewHistory={() => {}} onOpenSettings={() => setStep(AppStep.SETUP)} onViewSession={handleViewSession} />}
        {step === AppStep.SETUP && <SessionSetup prefs={userPrefs} initialMode={sessionConfig.mode} onStart={handleSessionStart} onBack={handleGoHome} onLoadHistory={handleViewSession} onHome={handleGoHome} />}
        {step === AppStep.STAGE && (
          <>
            <Stage config={sessionConfig} onFinish={handleSessionFinish} onBack={() => setStep(AppStep.SETUP)} />
            {isAnalyzing && (
              <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-6">
                <div className={`w-20 h-20 border-4 border-t-transparent rounded-full animate-spin mb-8 ${sessionConfig.mode === SessionMode.SPEECH ? 'border-blue-500' : 'border-rose-500'}`}></div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4">Analyzing Speech...</h2>
                <div className="w-full max-w-md bg-slate-800 rounded-full h-4 mb-4 overflow-hidden"><div className={`h-full bg-blue-500`} style={{ width: `${Math.floor(progress)}%` }}></div></div>
                <div className="h-24 w-full max-w-lg relative flex items-center justify-center">
                   {activeTips.map((tip, idx) => (
                     <div key={idx} className={`absolute inset-0 flex items-center justify-center text-center transition-opacity duration-700 ${idx === currentTipIndex ? 'opacity-100' : 'opacity-0'}`}><p className="text-slate-400 text-lg italic">"{tip}"</p></div>
                   ))}
                </div>
              </div>
            )}
          </>
        )}
        {step === AppStep.DEBATE_SESSION && (
            <>
                <DebateSession 
                    config={sessionConfig} 
                    onFinishDebate={handleDebateFinish} 
                    onBack={() => setStep(AppStep.SETUP)} 
                />
                {isAnalyzing && (
                  <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-6">
                    <div className="w-20 h-20 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-8"></div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-4">Judging Debate Round...</h2>
                    <p className="text-slate-400">Analyzing arguments, refutations, and logic flow.</p>
                  </div>
                )}
            </>
        )}
        {step === AppStep.ANALYSIS && analysisResult && (
          <Analysis 
            result={analysisResult} 
            onRestart={() => setStep(AppStep.SETUP)} 
            mode={sessionConfig.mode} 
            audioBlob={currentAudioBlob} 
            recordedDuration={recordedDuration} 
            topic={sessionConfig.topic} 
            language={sessionConfig.language} 
            onHome={handleGoHome} 
            onStartDrill={handleStartDrill} 
          />
        )}
        {step === AppStep.DRILL && (
          <DrillSession 
            type={activeDrillType} 
            language={sessionConfig.language} 
            contextTopic={sessionConfig.topic} 
            educationLevel={sessionConfig.educationLevel}
            onHome={handleGoHome} 
          />
        )}
      </div>
    </div>
  );
}
