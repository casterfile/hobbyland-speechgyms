
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserPreferences, SessionConfig, SessionMode, HistoryItem, SpeechLevel, TopicOutline, EducationLevel } from '../types';
import { generateTopic, generateTopicOutline } from '../services/geminiService';
import { getHistory } from '../services/historyService';
import { RefreshCw, Clock, Globe, Mic2, HeartHandshake, History, X, ChevronRight, Calendar, ArrowLeft, Eye, Laugh, Trophy, Scale, Menu, Lightbulb, ChevronLeft, Sparkles, Home, Tag, BookOpen, Swords, CheckCircle2 } from 'lucide-react';

interface Props {
  prefs: UserPreferences;
  initialMode: SessionMode;
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
  onLoadHistory: (item: HistoryItem) => void;
  onHome: () => void;
}

const INTERESTS = [
  "Technology", "Philosophy", "Education", "Society", 
  "Workplace", "Relationships", "Politics", "World News",
  "Debate", "Abstract", "Humor"
];

const COMEDY_THEMES = [
  "Parenting", "Workplace", "Dating/Marriage", "Technology", 
  "Traffic/Travel", "Aging", "Social Media", "Friendship", "Food/Diet"
];

const MODES_INFO = {
    [SessionMode.SPEECH]: { label: "Speech Practice", icon: Mic2, color: 'blue' },
    [SessionMode.EXPRESS]: { label: "Express Feelings", icon: HeartHandshake, color: 'rose' },
    [SessionMode.DEBATE]: { label: "Debate", icon: Scale, color: 'green' },
    [SessionMode.COMEDY]: { label: "Comedy Training", icon: Laugh, color: 'yellow' }
};

export const SessionSetup: React.FC<Props> = ({ prefs, initialMode, onStart, onBack, onLoadHistory, onHome }) => {
  const [setupStep, setSetupStep] = useState(1);

  // State
  const [topic, setTopic] = useState<string>("Loading topic...");
  const [customTopic, setCustomTopic] = useState("");
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(120);
  const [prepTime, setPrepTime] = useState(0);
  const [language, setLanguage] = useState("English");
  const [level, setLevel] = useState<SpeechLevel>(SpeechLevel.ADVANCED);
  const [educationLevel, setEducationLevel] = useState<EducationLevel>(EducationLevel.UNIVERSITY);
  const [comedyTheme, setComedyTheme] = useState<string>(COMEDY_THEMES[0]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(prefs.topics || []);
  const [debateSide, setDebateSide] = useState<'AFFIRMATIVE' | 'NEGATIVE'>('AFFIRMATIVE');
  
  const [outline, setOutline] = useState<TopicOutline | null>(null);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);

  const topicFetchedRef = useRef(false);

  const mode = initialMode || prefs.preferredMode || SessionMode.SPEECH;
  const isDebate = mode === SessionMode.DEBATE;

  const [showHistory, setShowHistory] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(prev => prev.filter(i => i !== interest));
    } else {
      setSelectedInterests(prev => [...prev, interest]);
    }
  };

  const fetchTopic = useCallback(async (force = false) => {
    if (isCustomTopic) return;
    if (!force && topicFetchedRef.current) return;
    
    setLoading(true);
    setOutline(null);
    topicFetchedRef.current = true;
    
    const relevantInterests = mode === SessionMode.COMEDY 
        ? [comedyTheme] 
        : (selectedInterests.length > 0 ? selectedInterests : ["General"]);

    try {
        const newTopic = await generateTopic(relevantInterests, "", language, mode, level, educationLevel);
        setTopic(newTopic);
    } catch (e) {
        setTopic("The Future of Technology");
    } finally {
        setLoading(false);
    }
  }, [selectedInterests, language, mode, level, educationLevel, isCustomTopic, comedyTheme]);

  useEffect(() => {
    if (setupStep === 2) {
        fetchTopic();
    } else {
        topicFetchedRef.current = false; // Reset when going back to step 1
    }
  }, [setupStep, fetchTopic]);

  const handleManualRefresh = () => {
      fetchTopic(true);
  };

  const handleStart = () => {
    onStart({
      topic: isCustomTopic ? customTopic : topic,
      durationSeconds: duration,
      language,
      mode,
      level,
      educationLevel,
      prepTimeSeconds: prepTime,
      debateSide: isDebate ? debateSide : undefined
    });
  };

  const handleGenerateMindmap = async () => {
      const currentTopic = isCustomTopic ? customTopic : topic;
      if (!currentTopic) return;
      setShowMindmap(true);
      if (outline) return;
      setLoadingOutline(true);
      try {
          const result = await generateTopicOutline(currentTopic, language, educationLevel);
          setOutline(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingOutline(false);
      }
  };

  const handleRegenerateTips = async () => {
      const currentTopic = isCustomTopic ? customTopic : topic;
      if (!currentTopic) return;
      setLoadingOutline(true);
      try {
          const result = await generateTopicOutline(currentTopic, language, educationLevel);
          setOutline(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingOutline(false);
      }
  };

  const toggleHistory = async () => {
    if (!showHistory) {
      const items = await getHistory();
      setHistoryItems(items);
    }
    setShowHistory(!showHistory);
    setIsMenuOpen(false);
  };

  if (showHistory) {
    return (
      <div className="min-h-screen w-full max-w-4xl mx-auto p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <History size={32} /> Session History
          </h2>
          <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>
        {historyItems.length === 0 ? (
          <div className="text-center py-20 text-slate-500"><p>No recorded sessions yet.</p></div>
        ) : (
          <div className="grid gap-4">
            {historyItems.map((item) => (
              <div key={item.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Calendar size={12} />
                    {new Date(item.date).toLocaleDateString()}
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-white">{item.mode}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-1">{item.topic}</h3>
                  <div className="text-xs text-slate-500">Score: {item.score}</div>
                </div>
                <button onClick={() => onLoadHistory(item)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                    <Eye size={16} /> Review
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const renderHeader = (title: string) => (
      <div className="w-full flex justify-between items-center mb-6 relative z-30">
        <div className="flex items-center gap-4">
           <div className="relative">
             <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors">
                <Menu size={28} />
             </button>
             {isMenuOpen && (
                 <div className="absolute top-12 left-0 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col z-50">
                     <button onClick={onBack} className="px-5 py-3 text-left text-sm hover:bg-slate-700 text-slate-200 flex items-center gap-2">
                        <ArrowLeft size={16} /> Return to Onboarding
                     </button>
                     <button onClick={toggleHistory} className="px-5 py-3 text-left text-sm hover:bg-slate-700 text-slate-200 flex items-center gap-2">
                        <History size={16} /> Session History
                     </button>
                 </div>
             )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
        </div>
      </div>
  );

  if (setupStep === 1) {
      const modeInfo = MODES_INFO[mode];
      const ModeIcon = modeInfo.icon;
      
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-2xl mx-auto p-6 animate-fade-in">
            {renderHeader("Configuration")}
            
            <div className="w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl space-y-8">
                
                <div onClick={onBack} className={`flex items-center gap-4 p-4 rounded-xl bg-${modeInfo.color}-900/20 border border-${modeInfo.color}-500/50 cursor-pointer hover:bg-${modeInfo.color}-900/30 transition-colors group`}>
                    <div className={`p-3 rounded-full bg-${modeInfo.color}-500 text-white`}>
                        <ModeIcon size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider group-hover:text-white transition-colors">Current Mode</div>
                        <div className="text-lg font-bold text-white">{modeInfo.label}</div>
                    </div>
                    <ChevronRight className="text-slate-500 group-hover:text-white" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                            <BookOpen size={18} className="text-indigo-400" /> Education Level
                        </label>
                        <select 
                            value={educationLevel} 
                            onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value={EducationLevel.ELEMENTARY}>Elementary School</option>
                            <option value={EducationLevel.MIDDLE_SCHOOL}>Middle School</option>
                            <option value={EducationLevel.HIGH_SCHOOL}>High School</option>
                            <option value={EducationLevel.UNIVERSITY}>University+</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                            <Globe size={18} className="text-teal-500" /> Language
                        </label>
                        <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="English">English</option>
                            <option value="Cantonese">Cantonese (粵語)</option>
                            <option value="Mandarin">Mandarin (普通話)</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="Japanese">Japanese</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                        <Trophy size={18} className="text-yellow-500" /> Speech Proficiency
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {[SpeechLevel.BEGINNER, SpeechLevel.ADVANCED, SpeechLevel.EXPERT].map((opt) => (
                            <button
                                key={opt}
                                onClick={() => setLevel(opt)}
                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                                    level === opt ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {mode !== SessionMode.COMEDY && (
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                            <Tag size={18} className="text-purple-500" /> Topic Interests
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {INTERESTS.map(interest => (
                                <button
                                    key={interest}
                                    onClick={() => toggleInterest(interest)}
                                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                        selectedInterests.includes(interest)
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                                            : 'bg-slate-900 border-slate-700 text-slate-400'
                                    }`}
                                >
                                    {interest}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <button onClick={() => setSetupStep(2)} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-lg font-bold rounded-xl shadow-lg transition-transform transform active:scale-[0.98] flex items-center justify-center gap-2">
                    Next Step <ChevronRight size={20} />
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] w-full max-w-5xl mx-auto p-4 md:p-6 animate-fade-in relative">
      {/* ... Mindmap code remains same ... */}
      {showMindmap && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6 md:p-10 w-full max-w-4xl relative overflow-hidden flex flex-col">
                   <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
                      <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                          <Sparkles className="text-purple-400" /> AI Mindmap ({educationLevel})
                      </h3>
                      <div className="flex gap-3">
                        <button onClick={handleRegenerateTips} disabled={loadingOutline} className="p-2.5 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors text-blue-300 flex items-center gap-2 text-sm font-bold">
                            <RefreshCw size={20} className={loadingOutline ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button onClick={() => setShowMindmap(false)} className="p-2.5 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors text-white">
                            <X size={20} />
                        </button>
                      </div>
                   </div>

                   {loadingOutline ? (
                       <div className="h-[450px] flex flex-col items-center justify-center text-slate-400">
                           <RefreshCw size={48} className="animate-spin mb-6 text-blue-500" />
                           <p className="text-xl font-medium">Brewing logic for {educationLevel} level...</p>
                       </div>
                   ) : outline ? (
                       <div className="relative h-[450px] w-full flex items-center justify-center">
                           <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
                                <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
                                <line x1="50%" y1="50%" x2="15%" y2="80%" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
                                <line x1="50%" y1="50%" x2="85%" y2="80%" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
                           </svg>
                           <div className="absolute z-20 w-44 h-44 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center p-6 text-center shadow-[0_0_50px_rgba(59,130,246,0.5)] border-4 border-slate-800 animate-float">
                               <p className="text-white font-black text-sm md:text-lg leading-tight uppercase tracking-tight">{outline.centralIdea}</p>
                           </div>
                           <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-36 h-36 rounded-full bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 flex items-center justify-center p-5 text-center shadow-2xl transition-transform hover:scale-110">
                               <p className="text-slate-200 text-xs md:text-sm font-bold leading-tight">{outline.points[0]}</p>
                           </div>
                           <div className="absolute bottom-[5%] left-[5%] w-36 h-36 rounded-full bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 flex items-center justify-center p-5 text-center shadow-2xl transition-transform hover:scale-110">
                               <p className="text-slate-200 text-xs md:text-sm font-bold leading-tight">{outline.points[1]}</p>
                           </div>
                           <div className="absolute bottom-[5%] right-[5%] w-36 h-36 rounded-full bg-slate-900/90 backdrop-blur-sm border-2 border-slate-600 flex items-center justify-center p-5 text-center shadow-2xl transition-transform hover:scale-110">
                               <p className="text-slate-200 text-xs md:text-sm font-bold leading-tight">{outline.points[2]}</p>
                           </div>
                       </div>
                   ) : (
                       <div className="text-center text-red-400 py-20">Failed to load.</div>
                   )}
              </div>
          </div>
      )}

      {renderHeader("Topic & Timing")}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
                 <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                        <Clock size={16} /> {isDebate ? "Round Duration" : "Speaking Duration"}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {isDebate ? (
                            [60, 120, 180, 300, 600].map(sec => (
                                <button key={sec} onClick={() => setDuration(sec)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${duration === sec ? 'bg-green-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-700'}`}>
                                    {sec / 60} Min
                                </button>
                            ))
                        ) : (
                            [60, 120, 180, 300].map(sec => (
                                <button key={sec} onClick={() => setDuration(sec)} className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${duration === sec ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-700'}`}>
                                    {sec / 60} Min
                                </button>
                            ))
                        )}
                    </div>
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                        <Clock size={16} /> Preparation Time
                    </label>
                    <select value={prepTime} onChange={(e) => setPrepTime(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white">
                        <option value={0}>Start Immediately</option>
                        <option value={60}>1 Minute</option>
                        <option value={180}>3 Minutes</option>
                        <option value={300}>5 Minutes</option>
                    </select>
                </div>
            </div>
            <button onClick={() => setSetupStep(1)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                <ChevronLeft size={16} /> Back to Config
            </button>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex-1 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="flex justify-center mb-8 relative z-10">
                <div className="bg-slate-900/80 p-1 rounded-xl flex gap-1 border border-slate-600">
                    <button onClick={() => setIsCustomTopic(false)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isCustomTopic ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>AI Generated</button>
                    <button onClick={() => setIsCustomTopic(true)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isCustomTopic ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Write My Own</button>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[220px] relative z-10">
                {!isCustomTopic && mode !== SessionMode.COMEDY && (
                   <button onClick={handleManualRefresh} disabled={loading} className="absolute top-0 right-0 p-3 bg-slate-700/50 hover:bg-slate-600 text-slate-300 rounded-bl-2xl transition-all">
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                   </button>
                )}
                {isCustomTopic ? (
                    <div className="w-full max-w-lg">
                        <input type="text" value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="Enter Your Prompt..." className="w-full bg-slate-900/50 border-b-2 border-slate-600 focus:border-blue-500 text-2xl font-bold text-white placeholder-slate-600 p-2 outline-none text-center" autoFocus />
                    </div>
                ) : (
                    <div className="text-center w-full px-4 flex flex-col items-center">
                         {mode === SessionMode.COMEDY && (
                             <div className="mb-4">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-widest block mb-2">Theme</label>
                                <select value={comedyTheme} onChange={(e) => setComedyTheme(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm outline-none">
                                    {COMEDY_THEMES.map(theme => <option key={theme} value={theme}>{theme}</option>)}
                                </select>
                             </div>
                         )}
                         <div className="bg-slate-900/40 px-3 py-1 rounded-full border border-slate-700/50 mb-6">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Level: {educationLevel}</span>
                         </div>
                         <h2 className="text-3xl md:text-5xl font-black leading-[1.15] text-white animate-fade-in tracking-tight max-w-xl">
                            {loading ? <span className="text-slate-600 animate-pulse">Brewing Topic...</span> : topic}
                        </h2>
                    </div>
                )}
                <button onClick={handleGenerateMindmap} disabled={loading || (isCustomTopic && !customTopic)} className="mt-8 px-5 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-sm font-bold flex items-center gap-2 transition-all">
                    <Sparkles size={16} /> Get AI Strategy
                </button>
                
                {/* DEBATE SIDE SELECTOR IN STEP 2 */}
                {isDebate && !loading && topic && (
                     <div className="mt-6 w-full max-w-md animate-fade-in">
                        <p className="text-center text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest">Choose Your Stance</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setDebateSide('AFFIRMATIVE')} className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${debateSide === 'AFFIRMATIVE' ? 'bg-green-600/20 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                               {debateSide === 'AFFIRMATIVE' && <CheckCircle2 size={16} className="text-green-500" />}
                               <span className="font-bold text-sm">Affirmative</span>
                            </button>
                            <button onClick={() => setDebateSide('NEGATIVE')} className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${debateSide === 'NEGATIVE' ? 'bg-red-600/20 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                               {debateSide === 'NEGATIVE' && <CheckCircle2 size={16} className="text-red-500" />}
                               <span className="font-bold text-sm">Negative</span>
                            </button>
                        </div>
                    </div>
                )}

            </div>
          </div>
          <button onClick={handleStart} disabled={loading || (isCustomTopic && !customTopic.trim())} className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xl font-bold rounded-2xl shadow-lg transition-transform transform active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed">
            Enter Stage <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
