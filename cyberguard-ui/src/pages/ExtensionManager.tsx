import { useState } from 'react';
import { motion } from 'framer-motion';
import { Puzzle, Download, Link, Mail, Ban, Eye, Bell } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';
import { useAuthStore } from '@/stores/authStore';

const defaultFeatures = {
  autoScan: true,
  autoDetect: true,
  autoBlock: false,
  highlighting: true,
  alerts: true,
};

const featureList = [
  { label: 'Auto URL Scanning', key: 'autoScan', icon: Link, description: 'Automatically scan all URLs you visit' },
  { label: 'Email Auto-Detection', key: 'autoDetect', icon: Mail, description: 'Detect phishing in Gmail & Outlook' },
  { label: 'Auto-Block Malicious Sites', key: 'autoBlock', icon: Ban, description: 'Prevent access to flagged domains' },
  { label: 'Malicious Link Highlighting', key: 'highlighting', icon: Eye, description: 'Highlight only confirmed malicious links' },
  { label: 'Instant Alerts', key: 'alerts', icon: Bell, description: 'Get notified of new threats' },
];

export default function ExtensionManager() {
  const user = useAuthStore((s) => s.user);
  const [features, setFeatures] = useState(() => {
    try {
      const saved = localStorage.getItem('cyberguard-ext-features');
      return saved ? JSON.parse(saved) : defaultFeatures;
    } catch { return defaultFeatures; }
  });

  const toggleFeature = (key: string) => {
    setFeatures((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('cyberguard-ext-features', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Status Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-safe/10 flex items-center justify-center shadow-glow-green shrink-0">
            <Puzzle className="w-8 h-8 text-safe" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-display text-xl font-bold text-foreground">CyberGuard Extension</h2>
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                user?.role === 'admin' ? 'bg-destructive/10 text-destructive' : 'bg-safe/10 text-safe'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" /> {user?.role || 'student'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Version 2.4.1 • ML-powered phishing detection with real dataset training</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Features Active', value: `${featureList.filter(f => features[f.key]).length}/${featureList.length}` },
            { label: 'Detection', value: 'ML-Powered' },
            { label: 'Datasets', value: 'Kaggle + PhishTank' },
          ].map(s => (
            <div key={s.label} className="text-center p-3 rounded-lg bg-muted/30">
              <p className="stat-number text-xl text-primary">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Feature Toggles */}
      <div className="space-y-3">
        {featureList.map((f, i) => (
          <motion.div key={f.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            <button
              onClick={() => toggleFeature(f.key)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${features[f.key] ? 'bg-primary' : 'bg-muted'} relative`}
            >
              <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-transform ${features[f.key] ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Install Guide & Account Pairing */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">Add to Chrome & Account Pairing</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Install the browser extension to automatically sync real-time threat scans to your dashboard.</p>
          </div>
          <GlowButton
            onClick={() => {
              window.open('https://github.com/SRG2004/CyberGuardAI/tree/main/extension', '_blank');
            }}
            icon={Download}
            variant="cyan"
            size="sm"
          >
            Download Extension Folder
          </GlowButton>
        </div>

        <div className="space-y-3 pt-2">
          {[
            'Open chrome://extensions in Google Chrome',
            'Enable "Developer Mode" using the toggle in the top right corner',
            'Click "Load unpacked" and select the extension/ folder',
            'Click the CyberGuard AI icon in your browser toolbar -> Go to "Account Sync"',
            `Log in with your account email (${user?.email || 'your email'}) to sync scans to this dashboard`,
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold shrink-0">{i + 1}</span>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

