import api from '@/lib/api';
import { persistAuthRole, persistAuthToken } from '@/lib/auth-storage';

export const completeAuthSession = async (accessToken: string) => {
  persistAuthToken(accessToken);
  const response = await api.get('/auth/me');
  if (response.data?.role?.name) {
    persistAuthRole(response.data.role.name);
  }
  return response.data;
};
