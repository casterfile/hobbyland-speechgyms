import React, { useState } from 'react';
import { subscriptionService } from '../services/subscriptionService';
import { Gift, X, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  prefillCode?: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onClose: () => void;
  onSuccess: () => void;
}

export const TrialCodeModal: React.FC<Props> = ({ prefillCode = '', isLoggedIn, onLogin, onClose, onSuccess }) => {
  const [code, setCode] = useState(prefillCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await subscriptionService.redeemTrialCode(code.trim());
      setSuccess(result.message);
      setTimeout(() => onSuccess(), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Gift size={20} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Redeem Trial Code</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!isLoggedIn ? (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm mb-4">Sign in first to redeem your trial code</p>
              <button
                onClick={onLogin}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>
              {prefillCode && (
                <p className="text-xs text-slate-500 mt-3">Code <span className="font-mono text-emerald-400">{prefillCode}</span> will be applied after sign in</p>
              )}
            </div>
          ) : success ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-800 rounded-xl animate-fade-in">
              <CheckCircle size={24} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-300 font-bold">{success}</p>
                <p className="text-emerald-400/70 text-xs mt-1">Redirecting...</p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Enter your code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                  placeholder="e.g. SPEECHPRO7"
                  autoFocus
                  className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg font-mono uppercase tracking-widest text-center placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-xl">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Activating...
                  </span>
                ) : 'Activate Free Trial'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
