
import React, { useState, useEffect, useRef } from 'react';
import { DrillType, DrillBatchResult, EducationLevel } from '../types';
import { generateDrillChallenges, analyzeDrillBatch } from '../services/geminiService';
import { Mic, Square, Loader2, ArrowRight, CheckCircle, Target, TrendingUp, RefreshCw, Home, Brain, Sparkles, ChevronRight, MessageSquare, ArrowRightCircle, Timer } from 'lucide-react';

interface Props {
  type: DrillType;
  language: string;
  contextTopic: string;
  educationLevel: EducationLevel;
  onHome: () => void;
}

export const DrillSession: React.FC<Props> = ({ type, language, contextTopic, educationLevel, onHome }) => {
  const [step, setStep] = useState<'INTRO' | 'COUNTDOWN' | 'PRACTICE' | 'ANALYSIS' | 'RESULT'>('INTRO');
  const [challenges, setChallenges] = useState<string[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [recordings, setRecordings] = useState<{ blob: Blob, prompt: string }[]>([]);
  const [result, setResult] = useState<DrillBatchResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [prepCountdown, setPrepCountdown] = useState(10);
  const [timeLeft, setTimeLeft] = useState(45);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const load = async () => {
        const prompts = await generateDrillChallenges(type, 3, language, contextTopic, educationLevel);
        setChallenges(prompts);
    };
    load();
  }, [type, language, contextTopic, educationLevel]);

  // Handle Prep Countdown (10s before each round)
  useEffect(() => {
    let interval: any;
    if (step === 'COUNTDOWN' && prepCountdown > 0) {
      interval = setInterval(() => setPrepCountdown(prev => prev - 1), 1000);
    } else if (step === 'COUNTDOWN' && prepCountdown === 0) {
      setStep('PRACTICE');
      startRecording(); // Auto-start recording
    }
    return () => clearInterval(interval);
  }, [step, prepCountdown]);

  // Handle Recording Time Left
  useEffect(() => {
    let interval: any;
    if (step === 'PRACTICE' && isRecording && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    if (timeLeft === 0 && isRecording) {
      stopRecording();
    }
    return () => clearInterval(interval);
  }, [isRecording, timeLeft, step]);

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            handleRoundFinish(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        recorder.start();
        setIsRecording(true);
        mediaRecorderRef.current = recorder;
    } catch (e) { alert("Microphone access required."); setStep('INTRO'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  };

  const handleRoundFinish = (blob: Blob) => {
    const newRecordings = [...recordings, { blob, prompt: challenges[currentRound] }];
    setRecordings(newRecordings);
    if (currentRound < 2) {
        setCurrentRound(prev => prev + 1);
        setPrepCountdown(10); // Reset for next round
        setTimeLeft(45);
        setStep('COUNTDOWN');
    } else {
        setStep('ANALYSIS');
        processBatch(newRecordings);
    }
  };

  const processBatch = async (recs: { blob: Blob, prompt: string }[]) => {
      try {
          const res = await analyzeDrillBatch(recs, type, language, educationLevel);
          setResult(res);
          setStep('RESULT');
      } catch (e) {
          onHome();
      }
  };

  const info = (() => {
      switch(type) {
          case DrillType.LOGIC: return { title: "Logic Linker", desc: "Connect concepts logically with speed.", color: "blue", icon: Brain };
          case DrillType.FLOW: return { title: "Smooth Flow", desc: "Speak clearly without filler words.", color: "green", icon: TrendingUp };
          case DrillType.CONTENT: return { title: "Rapid Fire", desc: "Respond to prompts instantly.", color: "yellow", icon: Sparkles };
          case DrillType.IMPACT: return { title: "Metaphor Master", desc: "Use metaphors to explain things.", color: "rose", icon: Target };
      }
  })();
  const Icon = info.icon;

  if (step === 'INTRO') {
      return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
              <div className="max-w-xl w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center shadow-2xl animate-fade-in">
                  <div className={`w-20 h-20 rounded-full bg-${info.color}-500/20 text-${info.color}-400 flex items-center justify-center mx-auto mb-6`}>
                      <Icon size={40} />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">{info.title}</h1>
                  <p className="text-slate-400 mb-6">{info.desc}</p>
                  <div className="p-4 bg-slate-900/50 rounded-xl mb-8 text-left border border-slate-700">
                     <div className="flex justify-between items-center mb-2">
                        <p className="text-xs text-slate-500 font-bold uppercase">Target Level: {educationLevel}</p>
                        <p className="text-xs text-slate-500 font-bold uppercase">3 Rounds</p>
                     </div>
                     <p className="text-white text-sm font-medium">Topic: "{contextTopic}"</p>
                  </div>
                  <button onClick={() => setStep('COUNTDOWN')} disabled={challenges.length === 0} className={`w-full py-4 bg-${info.color}-600 hover:bg-${info.color}-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-${info.color}-900/20`}>
                      {challenges.length === 0 ? <Loader2 className="animate-spin" /> : <>Start 3-Round Drill <ArrowRight /></>}
                  </button>
              </div>
          </div>
      );
  }

  if (step === 'COUNTDOWN') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
             <div className="w-full max-w-2xl text-center space-y-12 animate-fade-in">
                 <div className="space-y-4">
                    <p className="text-blue-400 text-xs font-black uppercase tracking-widest">Get Ready • Round {currentRound + 1}/3</p>
                    <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl shadow-2xl">
                        <p className="text-slate-500 text-[10px] mb-4 uppercase font-bold tracking-widest">Upcoming Prompt</p>
                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">"{challenges[currentRound]}"</h2>
                    </div>
                 </div>
                 <div className="flex flex-col items-center gap-4">
                    <div className="text-8xl font-black text-white flex items-center gap-4">
                        <Timer className="text-blue-500 w-16 h-16" /> {prepCountdown}
                    </div>
                    <p className="text-slate-400 font-medium">Recording starts automatically in {prepCountdown}s...</p>
                 </div>
             </div>
        </div>
      );
  }

  if (step === 'PRACTICE') {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black">
               <div className="w-full max-w-2xl text-center space-y-8 animate-fade-in">
                   <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                       <span>Round {currentRound + 1} / 3</span>
                       <span className="text-red-500 flex items-center gap-1"><Mic size={12} className="animate-pulse" /> Recording...</span>
                   </div>
                   <div className="bg-slate-900 border border-red-900/30 p-10 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                       <p className="text-slate-500 text-xs mb-4">Prompt</p>
                       <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">"{challenges[currentRound]}"</h2>
                   </div>
                   <div className="flex flex-col items-center gap-6">
                       <div className={`text-6xl font-mono font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>00:{timeLeft.toString().padStart(2, '0')}</div>
                       <button onClick={stopRecording} className="w-24 h-24 rounded-full bg-slate-800 border-4 border-red-500 flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.3)]"><Square size={32} className="text-red-500 fill-current" /></button>
                       <p className="text-slate-500 text-sm italic">Tap red square to finish early</p>
                   </div>
               </div>
          </div>
      );
  }

  if (step === 'ANALYSIS') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
            <Loader2 size={64} className="text-blue-500 animate-spin mb-6" />
            <h2 className="text-2xl font-bold">Processing Rounds...</h2>
            <p className="text-slate-400 mt-2 italic">Generating feedback for {educationLevel} level</p>
        </div>
      );
  }

  return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8 overflow-y-auto pb-20">
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
              <div className="flex justify-between items-center">
                  <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                      <TrendingUp className="text-blue-400" /> Drill Performance
                  </h1>
                  <button onClick={onHome} className="px-6 py-2 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-500 transition-colors">Finish Drill</button>
              </div>

              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl">
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-2 tracking-widest">Trend Summary ({educationLevel})</h3>
                  <p className="text-slate-200 leading-relaxed font-medium">{result?.overallImprovement}</p>
              </div>

              <div className="space-y-12">
                  {result?.rounds.map((r) => (
                      <div key={r.round} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg hover:border-slate-600 transition-colors">
                          <div className="p-4 bg-slate-700/50 border-b border-slate-600 flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                <span className="text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded tracking-widest">ROUND {r.round}</span>
                                <span className="text-white font-bold text-sm hidden sm:inline">Performance: {r.score}/10</span>
                             </div>
                             <div className="flex items-center gap-2 sm:hidden">
                                <span className={`text-xl font-black ${r.score >= 8 ? 'text-green-400' : r.score >= 6 ? 'text-yellow-400' : 'text-orange-400'}`}>{r.score}</span>
                                <span className="text-slate-500 text-xs">/10</span>
                             </div>
                             <div className="hidden sm:flex h-2 w-32 bg-slate-900 rounded-full overflow-hidden">
                                 <div className={`h-full ${r.score >= 8 ? 'bg-green-500' : r.score >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${r.score * 10}%` }}></div>
                             </div>
                          </div>
                          
                          <div className="p-6 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">The Prompt</p>
                                     <p className="text-white font-bold text-lg leading-tight">"{r.prompt}"</p>
                                  </div>
                                  <div className="space-y-2">
                                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                                         <MessageSquare size={12} /> Your Response
                                     </p>
                                     <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-sm text-slate-300 leading-relaxed italic">
                                         {r.transcript || "No speech detected."}
                                     </div>
                                  </div>
                              </div>

                              <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700">
                                  <p className="text-[10px] text-blue-400 font-bold uppercase mb-3 flex items-center gap-2 tracking-widest">
                                      <Brain size={12} /> Model Logic Roadmap
                                  </p>
                                  <p className="text-sm md:text-base text-slate-200 font-mono tracking-wide leading-relaxed">
                                      {r.logicFeedback || "N/A"}
                                  </p>
                              </div>

                              {r.vocabUpgrades && r.vocabUpgrades.length > 0 && (
                                  <div className="space-y-3">
                                      <p className="text-[10px] text-violet-400 font-black uppercase tracking-widest flex items-center gap-2">
                                          <Sparkles size={12} /> Drill Vocab Lab
                                      </p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          {r.vocabUpgrades.map((u, i) => (
                                              <div key={i} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700 flex items-center gap-3">
                                                  <div className="flex-1">
                                                      <p className="text-[9px] text-slate-500 font-bold line-through decoration-slate-600">{u.original}</p>
                                                      <p className="text-sm text-violet-200 font-bold">{u.suggested}</p>
                                                  </div>
                                                  <ArrowRightCircle size={16} className="text-violet-500" />
                                                  <div className="flex-1 text-xs text-slate-400 leading-tight italic">{u.tip}</div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              <div className="bg-indigo-900/20 p-5 rounded-xl border border-indigo-500/30 relative overflow-hidden group">
                                 <div className="flex justify-between items-center mb-3">
                                    <p className="text-[10px] text-indigo-300 font-bold uppercase flex items-center gap-2 tracking-widest">
                                        <Sparkles size={12} /> Expert Reference Version
                                    </p>
                                    <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">CEFR: {educationLevel}</p>
                                 </div>
                                 <p className="text-sm text-indigo-100 font-serif leading-relaxed italic mb-4 relative z-10">
                                     {r.polishedVersion}
                                 </p>
                                 <div className="flex flex-wrap gap-2 relative z-10">
                                     {r.keyTransitions.map((kw, i) => (
                                         <span key={i} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold border border-indigo-500/50">
                                             {kw}
                                         </span>
                                     ))}
                                 </div>
                                 <div className="absolute top-0 right-0 p-8 opacity-5 transform rotate-12 transition-transform group-hover:scale-110">
                                    <Sparkles size={80} className="text-indigo-400" />
                                 </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );
};
