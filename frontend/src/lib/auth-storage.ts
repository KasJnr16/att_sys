const TOKEN_KEY = 'token';
const TOKEN_COOKIE = 'auth_token';
const ROLE_COOKIE = 'auth_role';

const setCookie = (name: string, value: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
};

const clearCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const persistAuthToken = (token: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
  setCookie(TOKEN_COOKIE, token);
};

export const persistAuthRole = (role: string) => {
  setCookie(ROLE_COOKIE, role);
};

export const clearAuthSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }

  clearCookie(TOKEN_COOKIE);
  clearCookie(ROLE_COOKIE);
};
