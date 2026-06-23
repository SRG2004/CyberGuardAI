import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Threat, Paginated } from '@/types';

export function useLiveThreats() {
  return useQuery({
    queryKey: ['threats', 'live'],
    queryFn: async () => {
      const res = await api.get<Threat[]>('/api/threats/live');
      return res.data;
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  });
}

export function useThreats(page = 1, filters?: { type?: string; minScore?: number; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['threats', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filters?.type) params.set('type', filters.type);
      if (filters?.minScore) params.set('minScore', String(filters.minScore));
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const res = await api.get<Threat[]>(`/api/threats?${params}`);
      return { items: res.data, meta: res.meta };
    },
  });
}

export function useTodayStats() {
  return useQuery({
    queryKey: ['threats', 'stats', 'today'],
    queryFn: async () => {
      const res = await api.get('/api/threats/stats/today');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useTimelineStats() {
  return useQuery({
    queryKey: ['threats', 'stats', 'timeline'],
    queryFn: async () => {
      const res = await api.get('/api/threats/stats/timeline');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useRadarData() {
  return useQuery({
    queryKey: ['threats', 'stats', 'radar'],
    queryFn: async () => {
      const res = await api.get('/api/threats/stats/radar');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useVerifyThreat() {
  return useMutation({
    mutationFn: ({ threatId, verdict }: { threatId: string; verdict: string }) =>
      api.post<Threat>(`/api/threats/verify/${threatId}`, { verdict }),
  });
}
