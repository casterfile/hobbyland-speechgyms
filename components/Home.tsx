
import React, { useEffect, useState } from 'react';
import { UserPreferences, SessionMode, HistoryItem } from '../types';
import { getHistory } from '../services/historyService';
import { User } from '../services/authService';
import { SubscriptionInfo } from '../services/subscriptionService';
import { SubscriptionBadge } from './SubscriptionBadge';
import {
  Play, Mic2, Laugh, Scale, HeartHandshake, History,
  Settings, Trophy, TrendingUp, Calendar, ChevronRight, Sparkles, LogOut, Gift, CreditCard, AlertTriangle
} from 'lucide-react';

// Voice analysis depends on the browser's SpeechRecognition API. Firefox lacks it.
// Warn the user upfront so they can switch browsers before recording an answer
// that won't get transcribed.
const BrowserCompatBanner: React.FC = () => {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    }
  }, []);
  if (supported) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
      <div>
        <p className="font-bold text-amber-900 text-sm">Voice analysis isn't supported in this browser.</p>
        <p className="text-amber-800 text-xs leading-relaxed mt-1">
          Please switch to <span className="font-semibold">Chrome</span>, <span className="font-semibold">Edge</span>, or <span className="font-semibold">Safari</span> to record and score your speeches. The rest of the app still works here.
        </p>
      </div>
    </div>
  );
};

interface Props {
  prefs: UserPreferences;
  onStartSession: (mode?: SessionMode) => void;
  onViewHistory: () => void;
  onOpenSettings: () => void;
  onViewSession: (item: HistoryItem) => void;
  currentUser: User | null;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  subscriptionInfo: SubscriptionInfo | null;
  onOpenPricing: () => void;
  onRedeemCode?: () => void;
  onManageSubscription?: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
}

const SPEECH_TIPS_SHORT = [
  "Pause for 2-3 seconds before answering.",
  "Use the PREP method: Point, Reason, Example, Point.",
  "Maintain eye contact with the camera.",
  "Vary your vocal tone.",
  "Start with a hook: a story or question.",
  "Don't memorize; internalize key points.",
  "Turn nervous energy into enthusiasm."
];

export const Home: React.FC<Props> = ({ prefs, onStartSession, onViewHistory, onOpenSettings, onViewSession, currentUser, authLoading, onLogin, onLogout, subscriptionInfo, onOpenPricing, onRedeemCode, onManageSubscription, onPrivacy, onTerms }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dailyTip, setDailyTip] = useState("");
  const [stats, setStats] = useState({ totalSessions: 0, avgScore: 0 });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    // Async load of history
    const loadData = async () => {
        const items = await getHistory() || [];
        setHistory(items);
        
        // Calculate Stats
        if (items.length > 0) {
            const totalScore = items.reduce((acc, curr) => acc + (curr.score || 0), 0);
            setStats({
                totalSessions: items.length,
                avgScore: Math.round(totalScore / items.length)
            });
        }
    };
    loadData();

    // Set Random Tip
    const randomTip = SPEECH_TIPS_SHORT[Math.floor(Math.random() * SPEECH_TIPS_SHORT.length)];
    setDailyTip(randomTip);
  }, []);

  const getModeIcon = (mode: SessionMode) => {
      switch(mode) {
          case SessionMode.COMEDY: return <Laugh size={20} className="text-yellow-400" />;
          case SessionMode.DEBATE: return <Scale size={20} className="text-green-400" />;
          case SessionMode.EXPRESS: return <HeartHandshake size={20} className="text-rose-400" />;
          default: return <Mic2 size={20} className="text-blue-400" />;
      }
  };

  const trainingModes = [
    { id: SessionMode.SPEECH, label: "Speech", icon: Mic2, color: "blue" },
    { id: SessionMode.DEBATE, label: "Debate", icon: Scale, color: "green" },
    { id: SessionMode.EXPRESS, label: "Express", icon: HeartHandshake, color: "rose" },
    { id: SessionMode.COMEDY, label: "Comedy", icon: Laugh, color: "yellow" },
  ];

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto p-4 md:p-6 pb-20 animate-fade-in flex flex-col gap-8">
      <BrowserCompatBanner />
      
      {/* Header */}
      <div className="flex justify-between items-center mt-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
            Hello, {currentUser ? currentUser.name.split(' ')[0] : 'Speaker'}
          </h1>
          <p className="text-slate-400 text-sm md:text-base">Ready to master your voice today?</p>
        </div>
        <div className="flex items-center gap-3">
          {!authLoading && (currentUser ? (
            <>
              <SubscriptionBadge subscriptionInfo={subscriptionInfo} onClick={onOpenPricing} />
              <div className="relative">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-3 bg-slate-800 rounded-full pl-1 pr-4 py-1 border border-slate-700 hover:border-slate-600 transition-colors">
                  <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  <span className="text-sm text-slate-300 hidden md:block">{currentUser.name}</span>
                  <ChevronRight size={14} className={`text-slate-500 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
                </button>
                {showProfileMenu && (
                  <div className="absolute top-12 right-0 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col z-50">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                      <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                    </div>
                    {(subscriptionInfo?.tier === 'paid' || subscriptionInfo?.tier === 'trial') && onManageSubscription && (
                      <button onClick={() => { setShowProfileMenu(false); onManageSubscription(); }} className="px-4 py-3 text-left text-sm hover:bg-slate-700 text-slate-200 flex items-center gap-3">
                        <CreditCard size={15} className="text-blue-400" /> Manage Subscription
                      </button>
                    )}
                    {subscriptionInfo?.tier === 'free' && (
                      <button onClick={() => { setShowProfileMenu(false); onOpenPricing(); }} className="px-4 py-3 text-left text-sm hover:bg-slate-700 text-slate-200 flex items-center gap-3">
                        <Sparkles size={15} className="text-yellow-400" /> Upgrade to Pro
                      </button>
                    )}
                    {subscriptionInfo?.tier === 'free' && onRedeemCode && (
                      <button onClick={() => { setShowProfileMenu(false); onRedeemCode(); }} className="px-4 py-3 text-left text-sm hover:bg-slate-700 text-slate-200 flex items-center gap-3">
                        <Gift size={15} className="text-emerald-400" /> Redeem Code
                      </button>
                    )}
                    <button onClick={() => { setShowProfileMenu(false); onLogout(); }} className="px-4 py-3 text-left text-sm hover:bg-slate-700 text-red-400 flex items-center gap-3 border-t border-slate-700">
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button onClick={onLogin} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-sm font-medium text-slate-300 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign in
            </button>
          ))}
          <button
            onClick={onOpenSettings}
            className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors border border-slate-700"
            title="Preferences"
          >
            <Settings size={20} className="text-slate-300" />
          </button>
        </div>
      </div>

      {/* Main Hero / Quick Start */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Primary CTA with Training Modes Integrated */}
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 md:p-8 shadow-xl shadow-blue-900/20 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col h-full justify-between items-start w-full">
                  <div className="w-full">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-blue-100 uppercase tracking-wider mb-4">
                          <Sparkles size={12} /> Start Training
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                         Impromptu Practice
                      </h2>
                      <p className="text-blue-100 max-w-md mb-6">
                         Jump straight into a session. Choose your mode below:
                      </p>
                  </div>
                  
                  {/* Integrated Modes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                     {trainingModes.map(m => (
                        <button
                          key={m.id}
                          onClick={() => onStartSession(m.id)}
                          className="flex flex-col items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-3 transition-all hover:-translate-y-1 backdrop-blur-sm"
                        >
                           <div className={`p-2 rounded-full bg-white/10 text-${m.color}-200`}>
                              <m.icon size={20} />
                           </div>
                           <span className="text-xs font-bold text-white">{m.label}</span>
                        </button>
                     ))}
                  </div>
              </div>
              {/* Decorative BG */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700"></div>
          </div>

          {/* Stats Card */}
          <div className="md:col-span-1 bg-slate-800 rounded-3xl p-6 border border-slate-700 flex flex-col justify-between">
              <div>
                  <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-4">Your Progress</h3>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-black text-white">{stats.totalSessions}</span>
                      <span className="text-slate-500 mb-2">sessions</span>
                  </div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                      <TrendingUp size={20} />
                  </div>
                  <div>
                      <div className="text-xs text-slate-400">Avg. Score</div>
                      <div className="text-lg font-bold text-white">{stats.avgScore > 0 ? stats.avgScore : '-'}</div>
                  </div>
              </div>
          </div>
      </div>

      {/* Recent History & Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* History List */}
          <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History size={18} className="text-purple-400" /> Recent Sessions
                  </h3>
                  {history.length > 0 && (
                    <button onClick={onViewHistory} className="text-sm text-blue-400 hover:text-blue-300">View All</button>
                  )}
              </div>
              
              <div className="space-y-3">
                  {!history || history.length === 0 ? (
                      <div className="p-8 text-center bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed text-slate-500">
                          No history yet. Start your first session!
                      </div>
                  ) : (
                      history.slice(0, 3).map(item => (
                          <div 
                             key={item.id} 
                             onClick={() => onViewSession(item)}
                             className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-600 cursor-pointer flex items-center justify-between group transition-colors"
                          >
                              <div className="flex items-center gap-4">
                                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 group-hover:border-slate-500 transition-colors">
                                      {getModeIcon(item.mode)}
                                  </div>
                                  <div>
                                      <h4 className="font-semibold text-white line-clamp-1">{item.topic}</h4>
                                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                          <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(item.date).toLocaleDateString()}</span>
                                          <span className={`px-1.5 py-0.5 rounded bg-slate-700 text-slate-300`}>{item.mode}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <div className="text-right hidden sm:block">
                                      <div className="text-xs text-slate-400 uppercase font-bold">Score</div>
                                      <div className={`text-lg font-bold ${item.score >= 80 ? 'text-green-400' : item.score >= 60 ? 'text-yellow-400' : 'text-orange-400'}`}>
                                          {item.score}
                                      </div>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* Daily Tip Card */}
          <div className="lg:col-span-1">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                 <Sparkles size={18} className="text-yellow-400" /> Daily Tip
              </h3>
              <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles size={100} />
                  </div>
                  <div className="relative z-10">
                      <p className="text-lg font-serif italic text-slate-300 leading-relaxed mb-4">
                          "{dailyTip}"
                      </p>
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-1 bg-blue-500 rounded-full"></div>
                         <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Pro Tip</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600 pb-4">
        {onPrivacy && <button onClick={onPrivacy} className="hover:text-slate-400 transition-colors">Privacy Policy</button>}
        <span>·</span>
        {onTerms && <button onClick={onTerms} className="hover:text-slate-400 transition-colors">Terms & Conditions</button>}
        <span>·</span>
        <span>© 2026 DeFiner Tech Ltd</span>
      </div>

    </div>
  );
};
