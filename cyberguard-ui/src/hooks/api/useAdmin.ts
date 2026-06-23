import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { User } from '@/types';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await api.get('/api/admin/stats/overview');
      return res.data;
    },
  });
}

export function useUsers(page = 1) {
  return useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: async () => {
      const res = await api.get<{ items: User[]; meta: { page: number; total: number } }>(`/api/admin/users?page=${page}&limit=20`);
      return { items: res.data, meta: res.meta };
    },
  });
}

export function useChangeUserRole() {
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch<User>(`/api/admin/users/${userId}/role`, { role }),
  });
}

export function useToggleUserStatus() {
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch<User>(`/api/admin/users/${userId}/status`, { isActive }),
  });
}

export function useMlHealth() {
  return useQuery({
    queryKey: ['admin', 'api-health'],
    queryFn: async () => {
      const res = await api.get('/api/admin/api-health');
      return res.data;
    },
  });
}

export function useModelStats() {
  return useQuery({
    queryKey: ['admin', 'model-stats'],
    queryFn: async () => {
      const res = await api.get('/api/admin/model/stats');
      return res.data;
    },
  });
}

export function useRetrainModel() {
  return useMutation({
    mutationFn: () => api.post('/api/admin/model/retrain', {}),
  });
}

export function useAuditLogs(page = 1) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: async () => {
      const res = await api.get(`/api/admin/audit-logs?page=${page}&limit=50`);
      return { items: res.data, meta: res.meta };
    },
  });
}
