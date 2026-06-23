import { create } from 'zustand';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isInitialized: false,
  login: (user, token) => {
    localStorage.setItem('accessToken', token);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false });
  },
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  initialize: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isInitialized: true });
      return;
    }
    try {
      const res = await api.get<User>('/api/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isInitialized: true });
    }
  },
}));
