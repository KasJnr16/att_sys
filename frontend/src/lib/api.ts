import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast } from '@/lib/toast';
import { clearAuthSession } from '@/lib/auth-storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  detail: string;
  status_code?: number;
}

export interface RequestToastOptions {
  success?: boolean;
  error?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {
  toast?: boolean | RequestToastOptions;
  skipAuthRedirect?: boolean;
}

type RequestConfigWithToast = InternalAxiosRequestConfig & {
  toast?: boolean | RequestToastOptions;
  skipAuthRedirect?: boolean;
};

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const normalizeToastOptions = (config?: { toast?: boolean | RequestToastOptions }): RequestToastOptions => {
  if (config?.toast === false) {
    return { success: false, error: false };
  }

  if (config?.toast === true) {
    return { success: true, error: true };
  }

  return {
    success: config?.toast?.success ?? true,
    error: config?.toast?.error ?? true,
    successMessage: config?.toast?.successMessage,
    errorMessage: config?.toast?.errorMessage,
  };
};

const getNormalizedUrl = (url = '') => url.split('?')[0] ?? '';

const getDefaultSuccessMessage = (method?: string, url?: string) => {
  const normalizedUrl = getNormalizedUrl(url);

  if (method === 'post') {
    if (normalizedUrl === '/auth/register-user') return 'Account created successfully';
    if (normalizedUrl === '/auth/login') return 'Signed in successfully';
    if (normalizedUrl === '/lecturer/profile') return 'Profile saved successfully';
    if (normalizedUrl === '/academic/programmes') return 'Programme created successfully';
    if (normalizedUrl === '/academic/courses') return 'Course created successfully';
    if (normalizedUrl === '/academic/classes') return 'Class created successfully';
    if (/^\/academic\/classes\/\d+\/sessions$/.test(normalizedUrl)) return 'Session created successfully';
    if (normalizedUrl === '/attendance-sessions') return 'Attendance session started successfully';
    if (/^\/attendance-sessions\/\d+\/close$/.test(normalizedUrl)) return 'Attendance session closed successfully';
    return 'Action completed successfully';
  }

  if (method === 'put' || method === 'patch') {
    if (normalizedUrl === '/auth/me') return 'Settings saved successfully';
    return 'Changes saved successfully';
  }

  if (method === 'delete') {
    if (/^\/academic\/classes\/\d+$/.test(normalizedUrl)) return 'Class deleted successfully';
    if (/^\/lecturer\/classes\/\d+\/sessions\/\d+$/.test(normalizedUrl)) return 'Session deleted successfully';
    return 'Deleted successfully';
  }

  return 'Request completed successfully';
};

const getDefaultErrorMessage = (method?: string) => {
  if (method === 'delete') return 'We could not complete that delete action';
  if (method === 'put' || method === 'patch') return 'We could not save your changes';
  if (method === 'post') return 'We could not complete that action';
  return 'Something went wrong';
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(
  (config: RequestConfigWithToast) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as RequestConfigWithToast;
    const method = config.method?.toLowerCase();
    const toastOptions = normalizeToastOptions(config);

    if (method && MUTATING_METHODS.has(method) && toastOptions.success) {
      toast.success(toastOptions.successMessage ?? getDefaultSuccessMessage(method, config.url));
    }

    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const config = error.config as RequestConfigWithToast | undefined;
    const method = config?.method?.toLowerCase();
    const toastOptions = normalizeToastOptions(config);

    if (method && MUTATING_METHODS.has(method) && toastOptions.error) {
      toast.error(
        toastOptions.errorMessage ?? getDefaultErrorMessage(method),
        error.response?.data?.detail || error.message
      );
    }

    if (error.response?.status === 401 && !config?.skipAuthRedirect) {
      if (typeof window !== 'undefined') {
        clearAuthSession();
        window.location.href = '/auth/lecturer';
      }
    }

    if (error.response?.status === 403 && !config?.skipAuthRedirect) {
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    }

    return Promise.reject(error);
  }
);

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  return 'An unexpected error occurred';
};

export const isNetworkError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    return !error.response;
  }
  return false;
};

export default api;
