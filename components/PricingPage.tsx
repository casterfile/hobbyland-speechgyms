import React, { useState } from 'react';
import { SubscriptionInfo, subscriptionService } from '../services/subscriptionService';
import { ArrowLeft, Check, Sparkles, Crown, Gift, CheckCircle } from 'lucide-react';

interface Props {
  onBack: () => void;
  subscriptionInfo: SubscriptionInfo | null;
  onPrivacy?: () => void;
  onTerms?: () => void;
}

export const PricingPage: React.FC<Props> = ({ onBack, subscriptionInfo, onPrivacy, onTerms }) => {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialCode, setTrialCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);

  const handleCheckout = async (planInterval: 'monthly' | 'yearly') => {
    setLoading(planInterval);
    setError(null);
    try {
      const { url } = await subscriptionService.createCheckout(planInterval);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setLoading(null);
    }
  };

  const features = [
    'Unlimited speech sessions',
    'Full AI performance report',
    'Model answers & alternative scripts',
    'Vocabulary & grammar coaching',
    'Debate mode with AI opponent',
    'Drill exercises & progress tracking',
    'Cancel anytime',
  ];

  return (
    <div className="min-h-screen bg-slate-950 animate-fade-in">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles size={12} /> Unlock Your Full Potential
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">SpeechGyms Pro</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Get unlimited AI-powered speech analysis, coaching, and targeted practice drills.
          </p>
        </div>

        {(subscriptionInfo?.tier === 'paid' || subscriptionInfo?.tier === 'trial') && (
          <div className="max-w-md mx-auto mb-12 bg-slate-900 rounded-2xl p-6 border border-slate-700 text-center">
            <p className="text-sm text-slate-400 mb-1">You're on <span className="text-white font-bold">{subscriptionInfo.tier === 'trial' ? 'Free Trial' : 'Pro'}</span></p>
            <p className="text-xs text-slate-500 mb-4">Manage your billing, update payment method, or cancel anytime.</p>
            <button
              onClick={async () => {
                try {
                  const { url } = await subscriptionService.createPortalSession();
                  window.location.href = url;
                } catch (err: any) {
                  setError(err.message || 'Failed to open billing portal');
                }
              }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-slate-600"
            >
              Manage Subscription
            </button>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-900/20 border border-red-800 rounded-2xl text-center">
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Monthly Plan */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-700 hover:border-slate-600 transition-all hover:shadow-xl">
            <div className="mb-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Monthly</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">$9.90</span>
                <span className="text-sm text-slate-500 font-medium">/month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {features.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-400">
                  <Check size={14} className="text-blue-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loading !== null}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-600 disabled:opacity-50"
            >
              {loading === 'monthly' ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : 'Start 7-Day Free Trial'}
            </button>
          </div>

          {/* Yearly Plan */}
          <div className="bg-slate-900 rounded-3xl p-8 border-2 border-blue-500 shadow-xl shadow-blue-900/20 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
              <Crown size={10} /> Save 50%
            </div>

            <div className="mb-6">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Yearly</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">$59.90</span>
                <span className="text-sm text-slate-500 font-medium">/year</span>
              </div>
              <p className="text-xs text-blue-400 font-bold mt-1">Just $4.99/month</p>
            </div>

            <ul className="space-y-3 mb-8">
              {[...features, 'Best value'].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-400">
                  <Check size={14} className="text-blue-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('yearly')}
              disabled={loading !== null}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg disabled:opacity-50"
            >
              {loading === 'yearly' ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : 'Start 7-Day Free Trial'}
            </button>
          </div>
        </div>

        {/* Trial Code Section */}
        <div className="max-w-md mx-auto mt-16">
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Gift size={18} className="text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Have a trial code?</h3>
            </div>

            {codeSuccess ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-800 rounded-xl">
                <CheckCircle size={20} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300 font-medium">{codeSuccess}</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trialCode}
                  onChange={(e) => { setTrialCode(e.target.value.toUpperCase()); setError(null); }}
                  placeholder="Enter code"
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono uppercase tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={async () => {
                    if (!trialCode.trim()) return;
                    setCodeLoading(true);
                    setError(null);
                    try {
                      const result = await subscriptionService.redeemTrialCode(trialCode.trim());
                      setCodeSuccess(result.message);
                      setTimeout(() => onBack(), 2000);
                    } catch (err: any) {
                      setError(err.message);
                    } finally {
                      setCodeLoading(false);
                    }
                  }}
                  disabled={codeLoading || !trialCode.trim()}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {codeLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Redeem'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-12 space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            Your 7-day trial is free. You won't be charged until the trial ends. Cancel anytime from your account settings.
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600">
            {onPrivacy && <button onClick={onPrivacy} className="hover:text-slate-400 transition-colors">Privacy Policy</button>}
            <span>·</span>
            {onTerms && <button onClick={onTerms} className="hover:text-slate-400 transition-colors">Terms & Conditions</button>}
          </div>
        </div>
      </main>
    </div>
  );
};
