import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useExtensionStats() {
  return useQuery({
    queryKey: ['extension', 'stats'],
    queryFn: async () => {
      const res = await api.get('/api/extension/stats');
      return res.data;
    },
  });
}

export function useInitExtensionSession() {
  return useMutation({
    mutationFn: (data: { version?: string; userAgent?: string }) =>
      api.post<{ sessionId: string }>('/api/extension/session/init', data),
  });
}

export function useExtensionPing() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post('/api/extension/session/ping', { sessionId }),
  });
}

export function useExtensionBlocklistSync() {
  return useQuery({
    queryKey: ['extension', 'blocklist-sync'],
    queryFn: async () => {
      const res = await api.get<string[]>('/api/extension/blocklist/sync');
      return res.data;
    },
  });
}
