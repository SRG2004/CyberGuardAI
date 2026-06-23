import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  role?: 'student' | 'moderator' | 'admin';
}

export function ProtectedRoute({ role }: ProtectedRouteProps = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.user?.role);

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (role && userRole !== role && userRole !== 'admin') return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
