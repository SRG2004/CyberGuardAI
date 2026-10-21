import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Link as LinkIcon, Mail, Globe, ClipboardList,
  AlertTriangle, Puzzle, Settings, User, LogOut, QrCode,
  ChevronLeft, ChevronRight, LayoutDashboard, Users, AlertOctagon,
  KeyRound, MessageSquareText, MonitorSmartphone, FileSearch, Link2,
  Fingerprint, Activity, Database, Brain
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export type NavItem = {
  path: string;
  label: string;
  icon: typeof Shield;
  badge?: string;
  roles: string[];
};

export type NavGroup = {
  title?: string;
  roles: string[];
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  // ── Overview ──
  {
    roles: ['student'],
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student'] },
    ],
  },

  // ── Customer-Centric: Instant Threat Scanners ──
  {
    title: 'Threat Scanners',
    roles: ['student'],
    items: [
      { path: '/link-scanner', label: 'Link Scanner', icon: LinkIcon, badge: 'AI', roles: ['student'] },
      { path: '/email-scanner', label: 'Email Detector', icon: Mail, badge: 'AI', roles: ['student'] },
      { path: '/sms-scanner', label: 'SMS Smishing', icon: MessageSquareText, badge: 'AI', roles: ['student'] },
      { path: '/qr-scanner', label: 'QR Scanner', icon: QrCode, roles: ['student'] },
      { path: '/file-analyzer', label: 'File Analyzer', icon: FileSearch, roles: ['student'] },
      { path: '/unshortener', label: 'URL Tracer', icon: Link2, roles: ['student'] },
    ],
  },

  // ── Customer-Centric: Protection & Posture ──
  {
    title: 'Protection & Posture',
    roles: ['student'],
    items: [
      { path: '/password-check', label: 'Password Check', icon: KeyRound, roles: ['student'] },
      { path: '/device-audit', label: 'Device Audit', icon: MonitorSmartphone, roles: ['student'] },
      { path: '/header-analyzer', label: 'Header Spoof', icon: Fingerprint, roles: ['student'] },
    ],
  },

  // ── Customer-Centric: Records & Intelligence ──
  {
    title: 'Intelligence & Reports',
    roles: ['student'],
    items: [
      { path: '/scan-history', label: 'Scan History', icon: ClipboardList, roles: ['student'] },
      { path: '/report', label: 'Threat Hunter', icon: AlertOctagon, roles: ['student'] },
      { path: '/threat-feed', label: 'Global Threat Feed', icon: Globe, badge: 'LIVE', roles: ['student'] },
    ],
  },

  // ── Customer-Centric: Browser Defense ──
  {
    title: 'Integrations',
    roles: ['student'],
    items: [
      { path: '/extension', label: 'Chrome Extension', icon: Puzzle, roles: ['student'] },
    ],
  },

  // ── Admin Command & Control ──
  {
    title: 'Command & Control',
    roles: ['admin'],
    items: [
      { path: '/admin/overview', label: 'Admin Dashboard', icon: LayoutDashboard, roles: ['admin'] },
      { path: '/admin/queue', label: 'Review Queue', icon: AlertTriangle, roles: ['admin'] },
      { path: '/admin/blocklist', label: 'Blocklist Manager', icon: Database, roles: ['admin'] },
      { path: '/admin/users', label: 'User Management', icon: Users, roles: ['admin'] },
      { path: '/admin/api', label: 'API & Service Health', icon: Activity, roles: ['admin'] },
      { path: '/admin/model', label: 'ML Model Control', icon: Brain, roles: ['admin'] },
    ],
  },

  // ── Preferences & Account ──
  {
    title: 'Preferences',
    roles: ['student', 'admin'],
    items: [
      { path: '/settings', label: 'Settings', icon: Settings, roles: ['student', 'admin'] },
      { path: '/profile', label: 'Profile', icon: User, roles: ['student', 'admin'] },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const userRole = useAuthStore((s) => s.user?.role) || 'student';
  const userDisplayName = useAuthStore((s) => s.user?.displayName);
  const logoutStore = useAuthStore((s) => s.logout);

  const filteredGroups = navGroups
    .filter(g => g.roles.includes(userRole))
    .map(g => ({
      ...g,
      items: g.items.filter(item => item.roles.includes(userRole)),
    }))
    .filter(g => g.items.length > 0);

  const handleLogout = () => {
    logoutStore();
    window.location.href = '/';
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen sticky top-0 flex flex-col bg-background border-r border-border overflow-hidden z-50 shadow-sm"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <h1 className="font-display font-bold text-foreground text-sm whitespace-nowrap">CyberGuard AI</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-safe animate-pulse-glow" />
                <span className="text-[10px] text-safe font-medium">System Active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin scrollbar-thumb-muted">
        {filteredGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.title && (
              <>
                {!collapsed ? (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 select-none">
                    {group.title}
                  </p>
                ) : (
                  <div className="my-2 border-t border-border/40 mx-2" />
                )}
              </>
            )}

            {group.items.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 relative
                    ${isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-safe"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <item.icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex-1 flex items-center justify-between overflow-hidden"
                      >
                        <span className="whitespace-nowrap overflow-hidden font-medium text-xs leading-none">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider leading-none uppercase ${
                              item.badge === 'LIVE'
                                ? 'bg-safe/15 text-safe border border-safe/30 animate-pulse'
                                : item.badge === 'AI'
                                ? 'bg-primary/15 text-primary border border-primary/30'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-border p-3 space-y-2 shrink-0 bg-card/30">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
            <User className="w-4 h-4 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{userDisplayName || 'User'}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{userRole} Account</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/10"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
