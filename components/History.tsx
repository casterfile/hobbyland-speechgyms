import React, { useEffect, useState } from 'react';
import { HistoryItem, SessionMode } from '../types';
import { getHistory } from '../services/historyService';
import {
  ArrowLeft, History as HistoryIcon, Mic2, Laugh, Scale, HeartHandshake,
  Calendar, ChevronRight
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onViewSession: (item: HistoryItem) => void;
}

const getModeIcon = (mode: SessionMode) => {
  switch (mode) {
    case SessionMode.COMEDY: return <Laugh size={20} className="text-yellow-400" />;
    case SessionMode.DEBATE: return <Scale size={20} className="text-green-400" />;
    case SessionMode.EXPRESS: return <HeartHandshake size={20} className="text-rose-400" />;
    default: return <Mic2 size={20} className="text-blue-400" />;
  }
};

export const History: React.FC<Props> = ({ onBack, onViewSession }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items = await getHistory() || [];
      if (!cancelled) {
        setHistory(items);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <HistoryIcon size={22} className="text-purple-400" /> Session History
        </h2>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed text-slate-500">
            Loading sessions…
          </div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed text-slate-400">
            <HistoryIcon size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-slate-300">There are no sessions yet.</p>
            <p className="text-sm text-slate-500 mt-1">Finish a session and it will show up here.</p>
          </div>
        ) : (
          history.map(item => (
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
                    <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{item.mode}</span>
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
  );
};
