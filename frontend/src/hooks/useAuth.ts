import { useState, useEffect, useCallback } from 'react';
import api, { ApiRequestConfig, handleApiError } from '@/lib/api';
import { User } from '@/types';
import { clearAuthSession, persistAuthRole, persistAuthToken } from '@/lib/auth-storage';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setUser(null);
      return null;
    }

    persistAuthToken(token);

    try {
      const response = await api.get('/auth/me');
      if (response.data?.role?.name === 'student') {
        clearAuthSession();
        setUser(null);
        return null;
      }
      if (response.data?.role?.name) {
        persistAuthRole(response.data.role.name);
      }
      setUser(response.data as User);
      return response.data;
    } catch {
      clearAuthSession();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        skipAuthRedirect: true,
        toast: false,
      } as ApiRequestConfig);
      persistAuthToken(response.data.access_token);
      await fetchUser();
      return { success: true };
    } catch (err) {
      const message = handleApiError(err);
      if (message.toLowerCase().includes('student dashboard access is disabled')) {
        setError('Students should use the attendance verification link provided by their lecturer');
        return { success: false, error: 'Students should use the attendance verification link provided by their lecturer' };
      }
      if (message.includes('401') || message.toLowerCase().includes('incorrect')) {
        setError('Invalid email or password');
        return { success: false, error: 'Invalid email or password' };
      }
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchUser]);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/lecturer';
    }
  }, []);

  return { user, loading, error, login, logout, refreshUser: fetchUser };
};
