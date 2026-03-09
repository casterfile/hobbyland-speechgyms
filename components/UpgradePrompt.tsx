import React from 'react';

interface Props {
  reason: string;
  onUpgrade: () => void;
  onDismiss?: () => void;
}

const REASON_MESSAGES: Record<string, { title: string; message: string; icon: string }> = {
  paid_trial_expired: {
    title: 'Trial Ended',
    message: 'Your 7-day trial has expired. Upgrade to continue with full access to AI speech coaching.',
    icon: '\u23F0',
  },
  subscription_ended: {
    title: 'Subscription Ended',
    message: 'Your subscription has ended. Resubscribe to regain full access to analysis and coaching.',
    icon: '\uD83D\uDD04',
  },
  subscription_expired: {
    title: 'Go Pro',
    message: 'Start your free trial to unlock unlimited AI speech analysis, coaching, and drills.',
    icon: '\u2728',
  },
  payment_failed: {
    title: 'Payment Failed',
    message: 'We couldn\'t process your payment. Please update your billing info to restore access.',
    icon: '\uD83D\uDCB3',
  },
  subscription_required: {
    title: 'Start Your Free Trial',
    message: 'Add a payment method to start your 7-day free trial with full access. You won\'t be charged until the trial ends.',
    icon: '\u2728',
  },
};

export const UpgradePrompt: React.FC<Props> = ({ reason, onUpgrade, onDismiss }) => {
  const info = REASON_MESSAGES[reason] || REASON_MESSAGES.subscription_required;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
        <div className="p-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl mb-6 border border-slate-700">
            {info.icon}
          </div>

          <h3 className="text-2xl font-black text-white mb-3">{info.title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">{info.message}</p>

          <button
            onClick={onUpgrade}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg"
          >
            View Plans
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full mt-3 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
