export const ATTENDANCE_EXPIRATION_KEY = 'attendance_expiration';
export const ATTENDANCE_RADIUS_KEY = 'attendance_radius_meters';

export const DEFAULT_ATTENDANCE_EXPIRATION = '15';
export const DEFAULT_ATTENDANCE_RADIUS = '50';

const normalizePositiveInteger = (value: string, fallback: string, max: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return String(Math.min(parsed, max));
};

export const getStoredAttendanceExpiration = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_ATTENDANCE_EXPIRATION;
  }

  const saved = localStorage.getItem(ATTENDANCE_EXPIRATION_KEY);
  if (!saved) {
    return DEFAULT_ATTENDANCE_EXPIRATION;
  }

  return normalizePositiveInteger(saved, DEFAULT_ATTENDANCE_EXPIRATION, 60);
};

export const getStoredAttendanceRadius = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_ATTENDANCE_RADIUS;
  }

  const saved = localStorage.getItem(ATTENDANCE_RADIUS_KEY);
  if (!saved) {
    return DEFAULT_ATTENDANCE_RADIUS;
  }

  return normalizePositiveInteger(saved, DEFAULT_ATTENDANCE_RADIUS, 1000);
};
