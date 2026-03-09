import { getAuthHeaders } from './authService';

export interface SubscriptionInfo {
  status: string;
  tier: 'free' | 'trial' | 'paid';
  planInterval: string | null;
  paidTrialEndsAt: string | null;
  currentPeriodEnd: string | null;
  canAccessFullFeatures: boolean;
  requiresUpgrade: boolean;
  upgradeReason: string | null;
}

export const subscriptionService = {
  getStatus: async (): Promise<SubscriptionInfo | null> => {
    try {
      const res = await fetch('/api/subscription/status', { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  createCheckout: async (planInterval: 'monthly' | 'yearly'): Promise<{ url: string }> => {
    const res = await fetch('/api/subscription/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ planInterval }),
    });
    if (!res.ok) throw new Error('Failed to create checkout');
    return await res.json();
  },

  createPortalSession: async (): Promise<{ url: string }> => {
    const res = await fetch('/api/subscription/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to create portal session');
    return await res.json();
  },
};
