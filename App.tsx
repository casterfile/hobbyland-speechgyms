
import React, { useState, useEffect } from 'react';
import { AppStep, UserPreferences, SessionConfig, AnalysisResult, SessionMode, HistoryItem, SpeechLevel, DrillType, EducationLevel } from './types';
import { SessionSetup } from './components/SessionSetup';
import { Stage } from './components/Stage';
import { Analysis } from './components/Analysis';
import { Home } from './components/Home';
import { History } from './components/History';
import { DrillSession } from './components/DrillSession';
import { DebateSession } from './components/DebateSession';
import { analyzeSpeech, analyzeDebateSession } from './services/geminiService';
import { saveHistoryItem, retryPendingSaves } from './services/historyService';
import { User, getCurrentUser, handleAuthCallback, loginWithGoogle, logout } from './services/authService';
import { SubscriptionInfo, subscriptionService } from './services/subscriptionService';
import { PricingPage } from './components/PricingPage';
import { UpgradePrompt } from './components/UpgradePrompt';
import { SubscriptionBadge } from './components/SubscriptionBadge';
import { TrialCodeModal } from './components/TrialCodeModal';
import { PrivacyPolicy, TermsAndConditions } from './components/LegalPages';

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
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showTrialCodeModal, setShowTrialCodeModal] = useState(false);
  const [prefillCode, setPrefillCode] = useState('');

  useEffect(() => {
    handleAuthCallback();
    getCurrentUser().then(user => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        subscriptionService.getStatus().then(info => setSubscriptionInfo(info));
      }
    });

    // Check for ?code= URL param
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setPrefillCode(code.toUpperCase());
      setShowTrialCodeModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
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

  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastUnsavedItem, setLastUnsavedItem] = useState<HistoryItem | null>(null);
  const [retryingSave, setRetryingSave] = useState(false);

  const handleGoHome = () => {
    setAnalysisResult(null);
    setCurrentAudioBlob(null);
    setAnalysisError(false);
    setStep(AppStep.HOME);
  };

  const handleRetrySave = async () => {
    setRetryingSave(true);
    let result;
    if (lastUnsavedItem) {
      result = await saveHistoryItem(lastUnsavedItem);
    } else {
      result = await retryPendingSaves();
    }
    setRetryingSave(false);
    if (result.ok) {
      setSaveError(null);
      setLastUnsavedItem(null);
    } else {
      setSaveError(result.error || 'Save failed');
    }
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

  const handleSessionFinish = async (audioBlob: Blob, duration: number, transcript: string) => {
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
        sessionConfig.educationLevel,
        transcript,
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
      const saveRes = await saveHistoryItem(historyItem);
      if (saveRes.ok) {
        setSaveError(null);
        setLastUnsavedItem(null);
      } else {
        setSaveError(saveRes.error || 'Save failed');
        setLastUnsavedItem(historyItem);
      }
      setIsAnalyzing(false);
      setStep(AppStep.ANALYSIS);
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
      setAnalysisError(true);
    }
  };

  const handleDebateFinish = async (
    constructiveBlob: Blob,
    rebuttalBlob: Blob,
    aiCounter: string,
    constructiveTranscript: string,
    rebuttalTranscript: string,
  ) => {
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
        sessionConfig.educationLevel,
        constructiveTranscript,
        rebuttalTranscript,
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
      const saveRes = await saveHistoryItem(historyItem);
      if (saveRes.ok) {
        setSaveError(null);
        setLastUnsavedItem(null);
      } else {
        setSaveError(saveRes.error || 'Save failed');
        setLastUnsavedItem(historyItem);
      }
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
        {step === AppStep.HOME && <Home prefs={userPrefs} onStartSession={handleStartSessionFromHome} onViewHistory={() => setStep(AppStep.HISTORY)} onOpenSettings={() => setStep(AppStep.SETUP)} onViewSession={handleViewSession} currentUser={currentUser} authLoading={authLoading} onLogin={loginWithGoogle} onLogout={logout} subscriptionInfo={subscriptionInfo} onOpenPricing={() => setStep(AppStep.PRICING)} onRedeemCode={() => setShowTrialCodeModal(true)} onManageSubscription={async () => { try { const { url } = await subscriptionService.createPortalSession(); window.location.href = url; } catch (e) { console.error(e); } }} onPrivacy={() => setStep(AppStep.PRIVACY)} onTerms={() => setStep(AppStep.TERMS)} />}
        {step === AppStep.HISTORY && <History onBack={handleGoHome} onViewSession={handleViewSession} />}
        {step === AppStep.PRICING && <PricingPage onBack={handleGoHome} subscriptionInfo={subscriptionInfo} onPrivacy={() => setStep(AppStep.PRIVACY)} onTerms={() => setStep(AppStep.TERMS)} />}
        {step === AppStep.PRIVACY && <PrivacyPolicy onBack={handleGoHome} />}
        {step === AppStep.TERMS && <TermsAndConditions onBack={handleGoHome} />}
        {showUpgradePrompt && subscriptionInfo?.upgradeReason && (
          <UpgradePrompt
            reason={subscriptionInfo.upgradeReason}
            onUpgrade={() => { setShowUpgradePrompt(false); setStep(AppStep.PRICING); }}
            onDismiss={() => setShowUpgradePrompt(false)}
          />
        )}
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
            saveError={saveError}
            onRetrySave={handleRetrySave}
            retryingSave={retryingSave}
            onHome={handleGoHome}
            onStartDrill={handleStartDrill}
            subscriptionInfo={subscriptionInfo}
            onUpgrade={() => setStep(AppStep.PRICING)}
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
        {showTrialCodeModal && (
          <TrialCodeModal
            prefillCode={prefillCode}
            isLoggedIn={!!currentUser}
            onLogin={loginWithGoogle}
            onClose={() => setShowTrialCodeModal(false)}
            onSuccess={() => {
              setShowTrialCodeModal(false);
              subscriptionService.getStatus().then(info => setSubscriptionInfo(info));
            }}
          />
        )}
      </div>
    </div>
  );
}
