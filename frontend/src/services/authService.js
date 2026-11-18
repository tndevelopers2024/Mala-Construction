import apiClient from './apiClient';
import { getRefreshToken } from './tokenStorage';

export const authService = {
  login: (credentials) => apiClient.post('/auth/login', credentials).then((r) => r.data),
  logout: () => {
    const refreshToken = getRefreshToken();
    return apiClient.post('/auth/logout', { refreshToken }).then((r) => r.data);
  },
  logoutAllDevices: () => apiClient.post('/auth/logout-all').then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data),
  changePassword: (payload) => apiClient.post('/auth/change-password', payload).then((r) => r.data),
};
