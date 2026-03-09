
export interface User {
  id: number;
  email: string;
  name: string;
  avatar: string;
}

const TOKEN_KEY = 'speechgyms_token';

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
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getCurrentUser = async (): Promise<User | null> => {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
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
