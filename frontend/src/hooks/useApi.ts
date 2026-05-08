import { useState, useCallback } from 'react';
import api, { ApiRequestConfig, handleApiError } from '@/lib/api';
import { clearAuthSession, persistAuthRole, persistAuthToken } from '@/lib/auth-storage';
import { getStoredAttendanceRadius } from '@/lib/attendancePreferences';
import { getBrowserLocation } from '@/lib/geolocation';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiResult<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = unknown>(
  apiCall: (...args: unknown[]) => Promise<T>
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: unknown[]) => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await apiCall(...args);
        setState({ data: result as T, loading: false, error: null });
        return result as T;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setState({ data: null, loading: false, error: errorMessage });
        return null;
      }
    },
    [apiCall]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

export function useAuth() {
  const [user, setUser] = useState<unknown>(null);
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
      if ((response.data as { role?: { name?: string } })?.role?.name) {
        persistAuthRole((response.data as { role: { name: string } }).role.name);
      }
      setUser(response.data);
      return response.data;
    } catch {
      clearAuthSession();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
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
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      return false;
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
}

export function useLecturerClasses() {
  const [classes, setClasses] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/lecturer/classes');
      setClasses(response.data);
      return response.data;
    } catch (err) {
      setError(handleApiError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startAttendanceSession = useCallback(async (classId: number) => {
    try {
      const location = await getBrowserLocation();
      const now = new Date();
      const sessionRes = await api.post(`/academic/classes/${classId}/sessions`, {
        class_id: classId,
        session_date: now.toISOString().split('T')[0],
      }, { toast: false } as ApiRequestConfig);

      const classSessionId = sessionRes.data.id;

      const response = await api.post('/attendance-sessions', {
        class_session_id: classSessionId,
        expires_in_minutes: 15,
        max_uses: 100,
        latitude: location.latitude,
        longitude: location.longitude,
        radius_meters: parseInt(getStoredAttendanceRadius(), 10),
      }, { toast: false } as ApiRequestConfig);

      return response.data;
    } catch (err) {
      if (err instanceof Error && !('response' in err)) {
        throw err;
      }
      throw new Error(handleApiError(err));
    }
  }, []);

  return { classes, loading, error, fetchClasses, startAttendanceSession };
}

export function useStudentData() {
  const [classes, setClasses] = useState<unknown[]>([]);
  const [attendance, setAttendance] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, attendanceRes] = await Promise.all([
        api.get('/student/classes'),
        api.get('/student/attendance'),
      ]);
      setClasses(classesRes.data);
      setAttendance(attendanceRes.data);
      return { classes: classesRes.data, attendance: attendanceRes.data };
    } catch (err) {
      setError(handleApiError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { classes, attendance, loading, error, fetchData };
}

export function useAttendanceSession(sessionId: string | null) {
  const [session, setSession] = useState<unknown | null>(null);
  const [attendance, setAttendance] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/attendance-sessions/${sessionId}/status`);
      setSession(response.data);
      return response.data;
    } catch (err) {
      setError(handleApiError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchAttendance = useCallback(async (classSessionId: number) => {
    try {
      const response = await api.get(`/lecturer/sessions/${classSessionId}/attendance`);
      setAttendance(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      return null;
    }
  }, []);

  return { session, attendance, loading, error, fetchSession, fetchAttendance };
}
