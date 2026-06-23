import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuthResponse } from '@/types';
import { useAuthStore } from '@/stores/authStore';

export function useLogin() {
  const loginStore = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) => api.post<AuthResponse>('/api/auth/login', vars),
    onSuccess: (res) => {
      loginStore(res.data.user, res.data.accessToken);
    },
  });
}

export function useRegister() {
  const loginStore = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: (vars: { email: string; password: string; displayName: string }) =>
      api.post<AuthResponse>('/api/auth/register', vars),
    onSuccess: (res) => {
      loginStore(res.data.user, res.data.accessToken);
    },
  });
}

export function useLogout() {
  const logoutStore = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout', {}),
    onSettled: () => {
      logoutStore();
    },
  });
}

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: () => api.get<{ user: AuthResponse['user'] }>('/api/auth/me'),
    onSuccess: (res) => {
      setUser(res.data.user);
    },
  });
}
