import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { BlocklistEntry } from '@/types';

export function useCheckBlocklist(domain: string) {
  return useQuery({
    queryKey: ['blocklist', 'check', domain],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>(`/api/blocklist/check/${domain}`);
      return res.data;
    },
    enabled: !!domain,
  });
}

export function useBlocklist(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['blocklist', page, limit],
    queryFn: async () => {
      const res = await api.get<BlocklistEntry[]>(`/api/blocklist?page=${page}&limit=${limit}`);
      return { items: res.data, meta: res.meta };
    },
  });
}

export function useAddBlocklistEntry() {
  return useMutation({
    mutationFn: (data: { domain: string; reason: string; threatType: string }) =>
      api.post<BlocklistEntry>('/api/blocklist', data),
  });
}

export function useDeleteBlocklistEntry() {
  return useMutation({
    mutationFn: (domain: string) => api.delete(`/api/blocklist/${domain}`),
  });
}
