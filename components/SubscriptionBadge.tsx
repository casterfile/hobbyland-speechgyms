import React from 'react';
import { SubscriptionInfo } from '../services/subscriptionService';

interface Props {
  subscriptionInfo: SubscriptionInfo | null;
  onClick?: () => void;
}

export const SubscriptionBadge: React.FC<Props> = ({ subscriptionInfo, onClick }) => {
  if (!subscriptionInfo) return null;

  const { tier, paidTrialEndsAt } = subscriptionInfo;

  if (tier === 'paid') {
    return (
      <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-500/30 hover:bg-blue-500/30 transition-all">
        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
        Pro
      </button>
    );
  }

  if (tier === 'trial') {
    const daysLeft = paidTrialEndsAt
      ? Math.max(0, Math.ceil((new Date(paidTrialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 7;
    return (
      <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
        Trial {daysLeft}d
      </button>
    );
  }

  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-500/30 hover:bg-amber-500/30 transition-all">
      Free
    </button>
  );
};
