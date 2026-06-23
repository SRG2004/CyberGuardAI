import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Report } from '@/types';

export function useSubmitReport() {
  return useMutation({
    mutationFn: (data: FormData) => api.multipartPost('/api/reports', data),
  });
}

export function useReportTrack(anonId: string | undefined) {
  return useQuery({
    queryKey: ['report', 'track', anonId],
    queryFn: async () => {
      if (!anonId) throw new Error('No anonId');
      const res = await api.get<Report>(`/api/reports/track/${anonId}`);
      return res.data;
    },
    enabled: !!anonId,
  });
}

export function useReportQueue(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['reports', 'queue', page],
    queryFn: async () => {
      const res = await api.get<Report[]>(`/api/reports?page=${page}&limit=${limit}`);
      return { items: res.data, meta: res.meta };
    },
  });
}

export function useUpdateReportStatus() {
  return useMutation({
    mutationFn: ({ reportId, status, notes }: { reportId: string; status: string; notes?: string }) =>
      api.patch<Report>(`/api/reports/${reportId}/status`, { status, notes }),
  });
}
