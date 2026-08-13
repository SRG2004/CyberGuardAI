import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Link as LinkIcon, Mail, Globe, ClipboardList,
  AlertTriangle, Puzzle, Settings, User, LogOut,
  ChevronLeft, ChevronRight, LayoutDashboard, UserCog, Users, AlertOctagon, KeyRound, MessageSquareText, MonitorSmartphone, FileSearch, Link2, Fingerprint,
  Activity, Database, Brain
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

type NavItem = { path: string; label: string; icon: typeof Shield; roles: string[] };

const allNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student', 'admin'] },
  { path: '/scanner', label: 'Link Scanner', icon: LinkIcon, roles: ['student'] },
  { path: '/email-detector', label: 'Email Detector', icon: Mail, roles: ['student'] },
  { path: '/threat-feed', label: 'Threat Feed', icon: Globe, roles: ['admin'] },
  { path: '/scan-history', label: 'Scan History', icon: ClipboardList, roles: ['student'] },
  { path: '/report', label: 'Threat Hunter', icon: AlertOctagon, roles: ['student', 'admin'] },
  { path: '/password-check', label: 'Password Check', icon: KeyRound, roles: ['student'] },
  { path: '/sms-scanner', label: 'SMS Scanner', icon: MessageSquareText, roles: ['student'] },
  { path: '/device-audit', label: 'Device Audit', icon: MonitorSmartphone, roles: ['student'] },
  { path: '/file-analyzer', label: 'File Analyzer', icon: FileSearch, roles: ['student'] },
  { path: '/unshortener', label: 'URL Tracer', icon: Link2, roles: ['student'] },
  { path: '/header-analyzer', label: 'Header Spoof', icon: Fingerprint, roles: ['student'] },
  { path: '/extension', label: 'Extension Manager', icon: Puzzle, roles: ['student'] },
  { path: '/admin/overview', label: 'Admin: Overview', icon: Activity, roles: ['admin'] },
  { path: '/admin/queue', label: 'Admin: Review Queue', icon: AlertTriangle, roles: ['admin'] },
  { path: '/admin/blocklist', label: 'Admin: Blocklist', icon: Database, roles: ['admin'] },
  { path: '/admin/users', label: 'Admin: Users', icon: Users, roles: ['admin'] },
  { path: '/admin/api', label: 'Admin: API Health', icon: Activity, roles: ['admin'] },
  { path: '/admin/model', label: 'Admin: Model', icon: Brain, roles: ['admin'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['student', 'admin'] },
  { path: '/profile', label: 'Profile', icon: User, roles: ['student', 'admin'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const userRole = useAuthStore((s) => s.user?.role);
  const userDisplayName = useAuthStore((s) => s.user?.displayName);
  const logoutStore = useAuthStore((s) => s.logout);

  const navItems = allNavItems.filter(item => item.roles.includes(userRole || 'student'));

  const handleLogout = () => {
    logoutStore();
    window.location.href = '/';
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen sticky top-0 flex flex-col bg-background border-r border-border overflow-hidden z-50"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden">
              <h1 className="font-display font-bold text-foreground text-sm whitespace-nowrap">CyberGuard AI</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-safe animate-pulse-glow" />
                <span className="text-[10px] text-safe font-medium">System Active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative
                ${isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-safe"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{userDisplayName || 'User'}</p>
                <p className="text-[10px] text-muted-foreground">{(userRole || 'student').charAt(0).toUpperCase() + (userRole || 'student').slice(1)} Role</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={handleLogout} className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors rounded">
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
