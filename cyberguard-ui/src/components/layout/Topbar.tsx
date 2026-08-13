import { Bell, Search, Shield, Puzzle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';
import { toast } from 'sonner';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/scanner': 'Link Scanner',
  '/email-detector': 'Email Phishing Detector',
  '/threat-feed': 'Global Threat Feed',
  '/scan-history': 'Scan History',
  '/report': 'Anonymous Report',
  '/extension': 'Extension Manager',
  '/admin': 'Admin Panel',
  '/moderator': 'Moderator Panel',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

const placeholders = [
  'Scan a URL for threats...',
  'Paste email content to analyze...',
  'Search threat database...',
  'Check domain reputation...',
];

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const [hasUnread, setHasUnread] = useState(true);
  const title = pageTitles[location.pathname] || 'CyberGuard AI';

  const handleNotifications = () => {
    if (hasUnread) {
      toast('You have 2 new security alerts', {
        description: 'New high-risk threat detected in Global Feed.',
      });
      setHasUnread(false);
    } else {
      toast('No new notifications');
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const query = (e.target as HTMLInputElement).value;
      if (query.trim()) {
        toast(`Searching global database for: ${query}`);
      }
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={placeholders[0]}
            onKeyDown={handleSearch}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Add Extension to Chrome Button */}
        <button
          onClick={() => navigate('/extension')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-all shadow-sm"
          title="Add Extension to Chrome"
        >
          <Puzzle className="w-4 h-4" />
          <span className="hidden sm:inline">Add to Chrome</span>
        </button>

        {/* Role Badge */}
        {userRole && (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md capitalize ${userRole === 'admin' ? 'bg-destructive/10 text-destructive border border-destructive/30' :
            'bg-primary/10 text-primary border border-primary/20'
            }`}>
            {userRole}
          </span>
        )}

        {/* API Status */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-safe" /> GSB
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-safe" /> VT
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-safe" /> ML
          </span>
        </div>

        {/* Notifications */}
        <button
          onClick={handleNotifications}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Bell className="w-5 h-5" />
          {hasUnread && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-primary" />
        </div>
      </div>
    </header>
  );
}

