import { useMutation, useQuery } from '@tanstack/react-query';
import api, { multipartPost } from '@/lib/api';
import { ScanResponse, ScanHistoryItem } from '@/types';

export function useScanUrl() {
  return useMutation({
    mutationFn: (data: { url: string }) => api.post<ScanResponse>('/api/scan/url', data),
  });
}

export function useScanEmail() {
  return useMutation({
    mutationFn: (data: { subject: string; body: string }) => api.post<ScanResponse>('/api/scan/email', data),
  });
}

export function useBatchScan() {
  return useMutation({
    mutationFn: (data: { urls: string[] }) => api.post<ScanResponse[]>('/api/scan/batch', data),
  });
}

export function useScanHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['scan', 'history', page, limit],
    queryFn: async () => {
      const res = await api.get<ScanHistoryItem[]>(`/api/scan/history?page=${page}&limit=${limit}`);
      return { items: res.data, meta: res.meta };
    },
  });
}
