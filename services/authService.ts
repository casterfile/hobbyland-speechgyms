
export interface User {
  id: number;
  email: string;
  name: string;
  avatar: string;
}

const TOKEN_KEY = 'speechgyms_token';
const DEVICE_KEY = 'speechgyms_device_id';

// Stable per-browser ID. Lets the backend attribute anonymous sessions to a
// device so a user who saves while logged out and signs in later still sees
// (and can claim) their pre-login history.
export const getDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = { 'X-Device-Id': getDeviceId() };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      removeToken();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
};

export const handleAuthCallback = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    setToken(token);
    window.history.replaceState({}, '', '/');
    return true;
  }
  return false;
};

export const logout = () => {
  removeToken();
  window.location.reload();
};

export const loginWithGoogle = () => {
  window.location.href = '/api/auth/google';
};
