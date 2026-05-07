const ATTENDANCE_CLIENT_KEY = 'attendance_verify_client_id';

const createAttendanceClientId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getOrCreateAttendanceClientId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const existing = sessionStorage.getItem(ATTENDANCE_CLIENT_KEY);
  if (existing) {
    return existing;
  }

  const next = createAttendanceClientId();
  sessionStorage.setItem(ATTENDANCE_CLIENT_KEY, next);
  return next;
};

export const clearAttendanceClientId = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(ATTENDANCE_CLIENT_KEY);
};
