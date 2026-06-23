import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DashboardSummary, TopDomain, CategoryDistribution } from '@/types';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get<DashboardSummary>('/api/dashboard/summary');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useTopDomains() {
  return useQuery({
    queryKey: ['dashboard', 'top-domains'],
    queryFn: async () => {
      const res = await api.get<TopDomain[]>('/api/dashboard/top-domains');
      return res.data;
    },
    staleTime: 2 * 60_000,
  });
}

export function useCategoryDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'category-distribution'],
    queryFn: async () => {
      const res = await api.get<CategoryDistribution[]>('/api/dashboard/category-distribution');
      return res.data;
    },
    staleTime: 2 * 60_000,
  });
}
