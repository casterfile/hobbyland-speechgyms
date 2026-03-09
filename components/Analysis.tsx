
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AnalysisResult, SessionMode, DrillType } from '../types';
import { VirtualCoach } from './VirtualCoach';
import { translateText } from '../services/geminiService';
import { SubscriptionInfo } from '../services/subscriptionService';
import {
  AlertCircle, CheckCircle, Zap, MessageSquare, Mic, Lock,
  ThumbsUp, ThumbsDown, Heart, Brain, Play, Pause, BookOpen, Volume2, ChevronDown, ChevronUp, Bot, FileText, Laugh, Languages, PenTool, Scale, Menu, Target, ArrowRight, Sparkles, GraduationCap, Repeat, ArrowRightCircle, Globe, Swords
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis
} from 'recharts';

interface Props {
  result: AnalysisResult;
  onRestart: () => void;
  mode: SessionMode;
  audioBlob?: Blob | null;
  recordedDuration?: number;
  topic?: string;
  language?: string;
  onHome: () => void;
  onStartDrill?: (type: DrillType) => void;
  subscriptionInfo?: SubscriptionInfo | null;
  onUpgrade?: () => void;
}

const FadeUpgrade: React.FC<{ onUpgrade?: () => void; label?: string }> = ({ onUpgrade, label = "Upgrade to See Full Analysis" }) => (
  <div className="relative mt-[-80px] pt-20 pb-6 flex flex-col items-center" style={{ background: 'linear-gradient(to bottom, transparent, rgb(30 41 59) 40%)' }}>
    <Lock size={20} className="text-slate-500 mb-2" />
    <p className="text-slate-400 text-sm mb-3">{label}</p>
    <button onClick={onUpgrade} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
      <Zap size={14} /> Upgrade to Pro
    </button>
  </div>
);

const CustomAudioPlayer: React.FC<{ src: string, recordedDuration: number }> = ({ src, recordedDuration }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const duration = recordedDuration || 0;

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.load();
        setCurrentTime(0);
        setIsPlaying(false);
    }
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
      setIsPlaying(!isPlaying);
    }
  };

  const onTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
      <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />
      <div className="flex items-center gap-4">
        <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center text-white transition-all shadow-lg shadow-blue-500/20 shrink-0">
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
        </button>
        <div className="flex-1 flex flex-col justify-center gap-1">
          <input type="range" min="0" max={duration > 0 ? duration : (audioRef.current?.duration || 100)} value={currentTime} onChange={handleSeek} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400" />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration > 0 ? duration : (audioRef.current?.duration || 0))}</span>
          </div>
        </div>
        <button onClick={toggleSpeed} className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 min-w-[3rem]">{speed}x</button>
      </div>
    </div>
  );
};

const HighlightedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-indigo-300 font-bold bg-indigo-900/30 px-1 rounded">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

const TranscriptHighlighter: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const content = part.slice(2, -2);
          return (
            <span key={i} className="mx-1 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-200 rounded border border-yellow-500/30 text-sm font-medium">
              {content}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export const Analysis: React.FC<Props> = ({ result, onRestart, mode, audioBlob, recordedDuration = 0, topic = "Your Speech", language = "English", onHome, onStartDrill, subscriptionInfo, onUpgrade }) => {
  const isPaid = subscriptionInfo?.tier === 'paid' || subscriptionInfo?.tier === 'trial';
  const isSpeech = mode === SessionMode.SPEECH;
  const [activeFrameworkIndex, setActiveFrameworkIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'REPORT' | 'COACH'>('REPORT');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [targetLang, setTargetLang] = useState("Chinese (Traditional)");
  const [translatedModelAnswer, setTranslatedModelAnswer] = useState<string | null>(null);
  const [translatedFrameworks, setTranslatedFrameworks] = useState<any[] | null>(null);

  const audioUrl = useMemo(() => audioBlob ? URL.createObjectURL(audioBlob) : null, [audioBlob]);

  const structureTitle = isSpeech ? "Suggested Structure (Polished)" : "Narrative Flow (Polished)";
  const structureLabels = isSpeech 
    ? { point: 'Point', reason: 'Reason', example: 'Example', restate: 'Point (End)' }
    : { point: 'Emotion', reason: 'Context', example: 'Story', restate: 'Insight' };
  
  const isChinese = language?.toLowerCase().includes('chinese') || language?.toLowerCase().includes('cantonese') || language?.toLowerCase().includes('mandarin');

  const radarData = [
    { subject: 'Logic', A: result.subScores?.logic || result.overallScore, fullMark: 100 },
    { subject: 'Delivery', A: result.subScores?.delivery || result.overallScore, fullMark: 100 },
    { subject: 'Structure', A: result.subScores?.structure || result.overallScore, fullMark: 100 },
    { subject: 'Vocab', A: result.subScores?.vocabulary || result.overallScore, fullMark: 100 },
    { subject: 'Emotion', A: result.subScores?.emotion || result.overallScore, fullMark: 100 },
  ];

  const getModeIcon = () => {
      switch(mode) {
          case SessionMode.COMEDY: return <Laugh className="text-yellow-400" />;
          case SessionMode.DEBATE: return <Scale className="text-green-400" />;
          case SessionMode.EXPRESS: return <Heart className="text-rose-400" />;
          default: return <Brain className="text-blue-400" />;
      }
  };

  const getRecommendedDrill = () => {
      const scores = result.subScores || { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 };
      if (scores.delivery < 60 || result.fillerWordCount > 5) return { type: DrillType.FLOW, title: "Smooth Flow Drill", desc: "Detected filler words or pacing issues." };
      if (scores.logic < 60) return { type: DrillType.LOGIC, title: "Logic Linker", desc: "Strengthen coherence between concepts." };
      if (scores.vocabulary < 60 || scores.emotion < 60) return { type: DrillType.IMPACT, title: "Metaphor Master", desc: "Boost your rhetorical impact." };
      return { type: DrillType.CONTENT, title: "Rapid Fire Drill", desc: "Improve spontaneous content generation." };
  };

  const recommendedDrill = getRecommendedDrill();

  const handleTranslate = async () => {
      if (showTranslation) {
          setShowTranslation(false);
          return;
      }
      if (translatedModelAnswer && translatedFrameworks) {
          setShowTranslation(true);
          return;
      }
      setIsTranslating(true);
      try {
          const tModel = await translateText(result.modelAnswer, targetLang);
          const tFrameworks = await Promise.all(result.speechFramework.map(async (f) => ({
              ...f,
              polishedScript: await translateText(f.polishedScript, targetLang),
              description: await translateText(f.description, targetLang)
          })));
          setTranslatedModelAnswer(tModel);
          setTranslatedFrameworks(tFrameworks);
          setShowTranslation(true);
      } catch (e) {
          console.error("Translation failed", e);
      } finally {
          setIsTranslating(false);
      }
  };

  const renderTick = ({ payload, x, y, textAnchor, stroke, radius }: any) => {
    const data = radarData.find(d => d.subject === payload.value);
    if (!data) return null;
    return (
      <g className="layer">
        <text radius={radius} stroke={stroke} x={x} y={y} className="fill-slate-400 text-[10px] font-bold uppercase" textAnchor={textAnchor}>{payload.value}</text>
        <text radius={radius} stroke={stroke} x={x} y={y + 12} className={`text-sm font-black ${data.A < 50 ? 'fill-red-400' : 'fill-white'}`} textAnchor={textAnchor}>{data.A}</text>
      </g>
    );
  };

  const displayModelAnswer = showTranslation && translatedModelAnswer ? translatedModelAnswer : result.modelAnswer;
  const displayFrameworks = showTranslation && translatedFrameworks ? translatedFrameworks : result.speechFramework;

  return (
    <div className="w-full min-h-screen bg-slate-900 overflow-y-auto pb-20">
      <div className="w-full bg-slate-800 border-b border-slate-700 p-4 pt-12 md:pt-6 sticky top-0 z-50 backdrop-blur-md bg-opacity-90 shadow-md">
        <div className="max-w-[95%] mx-auto flex justify-between items-center gap-4 relative">
          <div className="relative">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"><Menu size={24} /></button>
             {isMenuOpen && (
                 <div className="absolute top-12 left-0 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col z-50">
                     <button onClick={onHome} className="px-4 py-3 text-left text-sm hover:bg-slate-700 text-slate-200">Home</button>
                     <button onClick={onRestart} className="px-4 py-3 text-left text-sm hover:bg-slate-700 text-slate-200">New Session</button>
                 </div>
             )}
          </div>
          <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex gap-1">
             <button onClick={() => setViewMode('REPORT')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'REPORT' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}><FileText size={16} /><span className="hidden md:inline">Static Report</span></button>
             <button onClick={() => setViewMode('COACH')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'COACH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}><Bot size={16} /><span className="hidden md:inline">Virtual Coach</span></button>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-[95%] mx-auto p-4 md:p-6 space-y-6 pt-6">
        <div className={viewMode === 'COACH' ? 'block animate-fade-in' : 'hidden'}>
           <div className="max-w-4xl mx-auto">
             {isPaid ? (
               <>
                 <div className="mb-6 text-center">
                   <h2 className="text-2xl font-bold text-white mb-2">Speak with your AI Coach</h2>
                   <p className="text-slate-400">Have a natural conversation. Ask for advice or practice a section of your speech.</p>
                 </div>
                 <VirtualCoach result={result} topic={topic} mode={mode} language={language || 'English'} />
               </>
             ) : (
               <div className="flex flex-col items-center justify-center py-20 text-center">
                 <div className="p-4 bg-slate-800 rounded-full mb-4 border border-slate-700"><Lock size={32} className="text-slate-500" /></div>
                 <h2 className="text-2xl font-bold text-white mb-2">Virtual Coach is a Pro Feature</h2>
                 <p className="text-slate-400 mb-6 max-w-md">Get personalized coaching conversations about your speech with our AI coach.</p>
                 <button onClick={onUpgrade} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"><Zap size={16} /> Upgrade to Pro</button>
               </div>
             )}
          </div>
        </div>

        <div className={viewMode === 'REPORT' ? 'block animate-fade-in space-y-6' : 'hidden'}>
             {onStartDrill && (
                <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-fade-in relative overflow-hidden">
                    <div>
                        <div className="flex items-center gap-2 text-blue-300 font-bold uppercase text-xs tracking-wider mb-2"><Target size={14} /> Recommended Practice</div>
                        <h3 className="text-xl font-bold text-white mb-1">{recommendedDrill.title}</h3>
                        <p className="text-slate-300 text-sm">{recommendedDrill.desc}</p>
                    </div>
                    {isPaid ? (
                      <button onClick={() => onStartDrill(recommendedDrill.type)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg transition-transform hover:scale-105 whitespace-nowrap">Start 3-Round Drill <ArrowRight size={18} /></button>
                    ) : (
                      <button onClick={onUpgrade} className="px-6 py-3 bg-slate-700 text-slate-300 font-bold rounded-xl flex items-center gap-2 whitespace-nowrap"><Lock size={16} /> Pro Only</button>
                    )}
                </div>
             )}

             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-2 md:mb-0">{getModeIcon()} Analysis Report</h1>
                 {isPaid ? (
                   <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                       <select value={targetLang} onChange={(e) => { setTargetLang(e.target.value); setShowTranslation(false); setTranslatedModelAnswer(null); }} className="bg-slate-900 text-xs md:text-sm text-white px-2 py-1.5 rounded-lg border-none outline-none">
                           <option value="Chinese (Traditional)">Traditional Chinese</option>
                           <option value="Chinese (Simplified)">Simplified Chinese</option>
                           <option value="Spanish">Spanish</option>
                           <option value="French">French</option>
                           <option value="Japanese">Japanese</option>
                           <option value="English">English</option>
                       </select>
                       <button
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${showTranslation ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'}`}
                       >
                           <Globe size={14} className={isTranslating ? 'animate-spin' : ''} />
                           {isTranslating ? 'Translating...' : showTranslation ? 'Original' : 'Translate'}
                       </button>
                   </div>
                 ) : (
                   <button onClick={onUpgrade} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-xl border border-slate-700 text-xs text-slate-500">
                     <Lock size={12} /> <Globe size={14} /> Translate (Pro)
                   </button>
                 )}
             </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col relative overflow-hidden">
                <div className="absolute top-4 left-4 z-10">
                   <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Overall Score</h3>
                   <span className="text-3xl font-black text-white">{result.overallScore}</span>
                </div>
                <div className="w-full h-[250px] mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={renderTick} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Score" dataKey="A" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between">
                        <div className={`flex items-center gap-2 mb-2 ${isSpeech ? 'text-blue-400' : 'text-rose-400'}`}><Mic size={18} /><span className="font-bold text-sm">Pacing</span></div>
                        <div><span className="text-4xl font-bold text-white">{result.wpm}</span><span className="text-slate-500 text-xs ml-2">{isChinese ? 'CPM' : 'WPM'}</span></div>
                    </div>
                    <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between">
                        <div className="flex items-center gap-2 text-yellow-400 mb-2"><AlertCircle size={18} /><span className="font-bold text-sm">Fillers</span></div>
                        <div><span className="text-4xl font-bold text-white">{result.fillerWordCount}</span><span className="text-slate-500 text-xs ml-2">detected</span></div>
                    </div>
                </div>
                {audioUrl && (
                  <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-2">Recording Playback</p>
                    <CustomAudioPlayer src={audioUrl} recordedDuration={recordedDuration} />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden relative">
               <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center gap-2 justify-between">
                 <div className="flex items-center gap-2">
                    <BookOpen size={20} className="text-teal-400" />
                    <h3 className="font-bold text-white">Recommended Frameworks</h3>
                    {!isPaid && <span className="text-[10px] font-bold bg-slate-700 text-slate-400 px-2 py-0.5 rounded">1 of {displayFrameworks.length}</span>}
                 </div>
                 {showTranslation && <span className="text-[10px] font-black uppercase bg-blue-600 px-2 py-0.5 rounded text-white tracking-widest">Translated</span>}
               </div>
               <div>
                 {(isPaid ? displayFrameworks : displayFrameworks.slice(0, 1)).map((framework, idx) => (
                   <div key={idx} className="border-b border-slate-700 last:border-0">
                     <button onClick={() => setActiveFrameworkIndex(idx)} className={`w-full flex items-center justify-between p-4 text-left transition-colors ${activeFrameworkIndex === idx ? 'bg-slate-700/30' : 'hover:bg-slate-700/10'}`}>
                        <div className="flex items-center gap-3">
                           <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeFrameworkIndex === idx ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{idx + 1}</div>
                           <span className={`font-semibold ${activeFrameworkIndex === idx ? 'text-white' : 'text-slate-300'}`}>{framework.name}</span>
                        </div>
                        {activeFrameworkIndex === idx ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-500" />}
                     </button>
                     {activeFrameworkIndex === idx && (
                        <div className="p-4 pl-4 md:pl-8 bg-slate-900/30 space-y-4 animate-fade-in">
                           <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-sm text-slate-300 italic">"{framework.description}"</div>
                           <div className="relative mt-2">
                             <div className="absolute -top-3 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">Polished Version</div>
                             <div className="bg-slate-900 p-5 rounded-lg border border-indigo-900/50 text-slate-200 text-sm md:text-base leading-relaxed font-serif"><HighlightedText text={framework.polishedScript} /></div>
                           </div>
                        </div>
                     )}
                   </div>
                 ))}
               </div>
               {!isPaid && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see all frameworks" />}
            </div>

            {/* Vocabulary & Transition Upgrades */}
            {result.vocabUpgrades && result.vocabUpgrades.length > 0 && (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl animate-fade-in relative">
                <div className="p-4 bg-violet-900/20 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-violet-400" />
                    <h3 className="font-bold text-white">Vocabulary & Transition Lab</h3>
                  </div>
                  <span className="text-[10px] font-black bg-violet-600 text-white px-2 py-0.5 rounded uppercase tracking-widest">{result.vocabUpgrades.length} Upgrades</span>
                </div>
                <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(isPaid ? result.vocabUpgrades : result.vocabUpgrades.slice(0, Math.ceil(result.vocabUpgrades.length / 2))).map((upgrade, idx) => (
                    <div key={idx} className="bg-slate-900/40 rounded-xl p-4 border border-slate-700 group hover:border-violet-500/50 transition-all flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter ${upgrade.type === 'transition' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                          {upgrade.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Used</p>
                          <p className="text-slate-400 font-medium line-through decoration-slate-600">{upgrade.original}</p>
                        </div>
                        <ArrowRightCircle size={20} className="text-violet-500 shrink-0" />
                        <div className="flex-1 text-right">
                          <p className="text-[10px] text-violet-400 uppercase font-black mb-1">Better</p>
                          <p className="text-violet-200 font-bold">{upgrade.suggested}</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400 italic leading-relaxed">
                        <span className="text-violet-500 font-bold mr-1">Pro Tip:</span> {upgrade.tip}
                      </div>
                    </div>
                  ))}
                </div>
                {!isPaid && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see all vocab upgrades" />}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6"><Zap size={20} className="text-purple-400" /><h3 className="font-bold text-white">Structure Analysis</h3></div>
                <div className={`mb-6 p-4 rounded-xl border ${result.structure.isPrep ? 'bg-green-900/20 border-green-800' : 'bg-orange-900/20 border-orange-800'}`}>
                   <div className="flex items-start gap-3">
                      {result.structure.isPrep ? <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} /> : <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />}
                      <div><h4 className={`text-sm font-bold mb-1 ${result.structure.isPrep ? 'text-green-400' : 'text-orange-400'}`}>{result.structure.isPrep ? "Good Structure" : "Needs Structure"}</h4><p className="text-sm text-slate-300 leading-relaxed">{result.structure.feedback}</p></div>
                   </div>
                </div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{structureTitle}</h4>
                <div className="space-y-3">
                  {(isPaid ? [
                    { label: structureLabels.point, text: result.structure.point, color: 'border-blue-500/50' },
                    { label: structureLabels.reason, text: result.structure.reason, color: 'border-cyan-500/50' },
                    { label: structureLabels.example, text: result.structure.example, color: 'border-teal-500/50' },
                    { label: structureLabels.restate, text: result.structure.pointRestated, color: 'border-blue-500/50' },
                  ] : [
                    { label: structureLabels.point, text: result.structure.point, color: 'border-blue-500/50' },
                    { label: structureLabels.reason, text: result.structure.reason, color: 'border-cyan-500/50' },
                  ]).map((item, i) => (
                    <div key={i} className={`p-3 rounded-lg bg-slate-900/50 border-l-4 ${item.color}`}><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{item.label}</div><p className="text-sm text-slate-200">{item.text || "Not detected"}</p></div>
                  ))}
                </div>
                {!isPaid && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see full structure" />}
              </div>
              <div className="space-y-6">
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 relative overflow-hidden">
                   <div className="flex items-center gap-2 mb-4 text-green-400"><ThumbsUp size={20} /><h3 className="font-bold">Strengths</h3></div>
                   <ul className="space-y-2">{(isPaid ? result.strengths : result.strengths.slice(0, Math.ceil(result.strengths.length / 2))).map((str, i) => (<li key={i} className="flex gap-2 text-sm text-slate-300 items-start"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div><span>{str}</span></li>))}</ul>
                   {!isPaid && result.strengths.length > 2 && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see all strengths" />}
                </div>
                <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 relative overflow-hidden">
                   <div className="flex items-center gap-2 mb-4 text-red-400"><ThumbsDown size={20} /><h3 className="font-bold">Areas for Improvement</h3></div>
                   <ul className="space-y-2">{(isPaid ? result.weaknesses : result.weaknesses.slice(0, Math.ceil(result.weaknesses.length / 2))).map((weak, i) => (<li key={i} className="flex gap-2 text-sm text-slate-300 items-start"><div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></div><span>{weak}</span></li>))}</ul>
                   {!isPaid && result.weaknesses.length > 2 && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see all improvements" />}
                </div>
              </div>
            </div>

            {/* Model Answer placed before Original Transcript */}
            {!result.debateAnalysis && displayModelAnswer && (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg animate-fade-in relative">
                <div className="p-4 bg-indigo-900/30 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={20} className="text-indigo-400" />
                    <h3 className="font-bold text-white">Expert Model Answer</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {showTranslation && <span className="text-[10px] font-black uppercase bg-blue-600 px-2 py-0.5 rounded text-white tracking-widest">Translated</span>}
                    <div className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-black rounded uppercase tracking-wider">Ideal Response</div>
                  </div>
                </div>
                <div className="p-8 relative">
                  <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500/50"></div>
                  <div className="text-slate-200 leading-relaxed text-base md:text-lg font-serif italic relative">
                    <span className="absolute -top-6 -left-2 text-6xl text-indigo-500/20 font-serif opacity-50">"</span>
                    <HighlightedText text={isPaid ? displayModelAnswer : displayModelAnswer.slice(0, Math.floor(displayModelAnswer.length * 0.4)) + '...'} />
                    <span className="absolute -bottom-8 -right-2 text-6xl text-indigo-500/20 font-serif opacity-50">"</span>
                  </div>
                </div>
                {!isPaid && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see the full model answer" />}
              </div>
            )}

            {/* DEBATE SPECIFIC SPLIT VIEW */}
            {result.debateAnalysis && (
                <div className="space-y-6">
                    {/* Round 1 */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg animate-fade-in relative">
                        <div className="p-4 bg-green-900/30 border-b border-slate-700 flex items-center gap-2">
                            <Swords size={20} className="text-green-400" />
                            <h3 className="font-bold text-white">Round 1: Constructive Speech</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Your Transcript</h4>
                                <div className="p-4 bg-slate-900/50 rounded-xl text-slate-300 text-sm italic">{result.debateAnalysis.constructive.transcript}</div>
                            </div>
                            <div className="relative overflow-hidden">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Expert Constructive Model</h4>
                                <div className="p-4 bg-indigo-900/20 rounded-xl text-indigo-200 text-sm font-serif">
                                  {isPaid ? result.debateAnalysis.constructive.modelAnswer : result.debateAnalysis.constructive.modelAnswer.slice(0, Math.floor(result.debateAnalysis.constructive.modelAnswer.length * 0.4)) + '...'}
                                </div>
                                {!isPaid && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see full model" />}
                            </div>
                        </div>
                    </div>

                    {/* Round 2 */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg animate-fade-in relative">
                        <div className="p-4 bg-red-900/30 border-b border-slate-700 flex items-center gap-2">
                            <Swords size={20} className="text-red-400" />
                            <h3 className="font-bold text-white">Round 2: Rebuttal</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Your Transcript</h4>
                                <div className="p-4 bg-slate-900/50 rounded-xl text-slate-300 text-sm italic">{result.debateAnalysis.rebuttal.transcript}</div>
                            </div>
                            <div className="relative overflow-hidden">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Expert Rebuttal Model</h4>
                                <div className="p-4 bg-indigo-900/20 rounded-xl text-indigo-200 text-sm font-serif">
                                  {isPaid ? result.debateAnalysis.rebuttal.modelAnswer : result.debateAnalysis.rebuttal.modelAnswer.slice(0, Math.floor(result.debateAnalysis.rebuttal.modelAnswer.length * 0.4)) + '...'}
                                </div>
                                {!isPaid && <FadeUpgrade onUpgrade={onUpgrade} label="Upgrade to see full model" />}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!result.debateAnalysis && (
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
                    <MessageSquare size={20} className="text-slate-400" />
                    <h3 className="font-bold text-white">Original Transcript</h3>
                </div>
                <div className="p-6 text-slate-300 leading-relaxed text-sm md:text-base whitespace-pre-wrap"><TranscriptHighlighter text={result.transcript} /></div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
