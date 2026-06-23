import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Shield, Eye } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const defaultSettings = {
  notificationEmail: true,
  notificationBrowser: true,
  notificationDigest: false,
  notificationReports: true,
  security2fa: false,
  securityAutoBlock: true,
  securityShareData: true,
  displayRiskScores: true,
  displayCompact: false,
  displayAnimations: true,
};

export default function SettingsPage() {
  const userRole = useAuthStore((s) => s.user?.role);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(`cyberguard-settings-${userRole || 'student'}`);
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(`cyberguard-settings-${userRole || 'student'}`, JSON.stringify(settings));
  }, [settings, userRole]);

  const toggle = (key: string) => setSettings((prev: Record<string, boolean>) => ({ ...prev, [key]: !prev[key] }));

  const groups = [
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { key: 'notificationEmail', label: 'Email alerts for high-risk threats' },
        { key: 'notificationBrowser', label: 'Browser push notifications' },
        { key: 'notificationDigest', label: 'Daily threat summary digest' },
        { key: 'notificationReports', label: 'New anonymous report alerts' },
      ],
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        { key: 'security2fa', label: 'Two-factor authentication' },
        { key: 'securityAutoBlock', label: 'Auto-block malicious sites' },
        { key: 'securityShareData', label: 'Share anonymous scan data' },
      ],
    },
    {
      title: 'Display',
      icon: Eye,
      items: [
        { key: 'displayRiskScores', label: 'Show risk scores on threat feed' },
        { key: 'displayCompact', label: 'Compact view mode' },
        { key: 'displayAnimations', label: 'Show animated effects' },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary" /> Settings
        </h2>
      </motion.div>

      {groups.map((group, gi) => (
        <motion.div key={group.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.1 }} className="glass-card p-6">
          <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2 mb-4">
            <group.icon className="w-4 h-4 text-primary" /> {group.title}
          </h3>
          <div className="space-y-3">
            {group.items.map((item) => {
              const enabled = settings[item.key] ?? false;
              return (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <button
                    onClick={() => toggle(item.key)}
                    className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'} relative`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <button
          onClick={() => {
            setSettings(defaultSettings);
            localStorage.removeItem(`cyberguard-settings-${userRole || 'student'}`);
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset all settings to defaults
        </button>
      </motion.div>
    </div>
  );
}
