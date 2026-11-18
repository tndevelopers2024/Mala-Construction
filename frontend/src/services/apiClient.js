import axios from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Always send/receive cross-origin httpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

// Intercept request to:
// 1. Ensure FormData uploads dynamically set multipart boundary
// 2. Attach Authorization Bearer header if token exists (resilience against 3rd-party cookie blocking)
apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const token = getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// --- Auto refresh-on-401 ---
// Queues concurrent requests that fail while a refresh is already in flight,
// so we don't fire multiple parallel refresh calls.
let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(error, newAccessToken = null) {
  pendingQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      if (newAccessToken) {
        config.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      resolve(apiClient(config));
    }
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';

    // Handle 429 Too Many Requests:
    // Never trigger a session refresh or logout on rate limit; preserve existing session
    if (status === 429) {
      error.isRateLimited = true;
      return Promise.reject(error);
    }

    // Only skip refresh for login, register, and refresh itself to prevent infinite retry loops
    const isRefreshOrAuthEntry =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh');

    if (status === 401 && !originalRequest._retry && !isRefreshOrAuthEntry) {
      const storedRefreshToken = getRefreshToken();
      const hasStoredToken = Boolean(getAccessToken() || storedRefreshToken);

      // If this was an initial /auth/me check and there are no stored tokens at all,
      // the user is simply an unauthenticated visitor. Do not spam /auth/refresh.
      if (url.includes('/auth/me') && !hasStoredToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the in-flight refresh, then retry this request.
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshPayload = storedRefreshToken ? { refreshToken: storedRefreshToken } : {};
        const refreshHeaders = storedRefreshToken ? { 'x-refresh-token': storedRefreshToken } : {};

        const res = await apiClient.post('/auth/refresh', refreshPayload, {
          headers: refreshHeaders,
        });

        const newAccessToken = res.data?.accessToken;
        const newRefreshToken = res.data?.refreshToken;

        if (newAccessToken) {
          setTokens({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken || storedRefreshToken,
          });
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        resolveQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh failed due to 429 (rate limit), don't kill the session or wipe tokens!
        if (refreshError.response?.status === 429) {
          resolveQueue(refreshError);
          return Promise.reject(refreshError);
        }

        clearTokens();
        resolveQueue(refreshError);
        // Refresh failed (401/403) - session is genuinely over.
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
