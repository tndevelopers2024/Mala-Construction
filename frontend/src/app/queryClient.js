import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        // Never retry client errors, auth failures, or rate limits
        if (status === 401 || status === 403 || status === 404 || status === 429 || error?.isRateLimited) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
