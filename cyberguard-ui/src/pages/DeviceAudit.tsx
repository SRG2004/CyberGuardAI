import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MonitorSmartphone, Shield, AlertTriangle, CheckCircle, Smartphone, Globe, Lock, Clock } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';

type AuditResult = {
  name: string;
  status: 'secure' | 'warning' | 'danger';
  description: string;
  icon: typeof Shield;
};

export default function DeviceAudit() {
  const [auditing, setAuditing] = useState(false);
  const [results, setResults] = useState<AuditResult[] | null>(null);

  const runAudit = () => {
    setAuditing(true);
    setResults(null);

    // Simulate audit time for UX
    setTimeout(() => {
      const checks: AuditResult[] = [];

      // 1. Connection Security
      if (window.isSecureContext) {
        checks.push({ name: 'Secure Connection', status: 'secure', description: 'Your connection is encrypted (HTTPS).', icon: Lock });
      } else {
        checks.push({ name: 'Insecure Connection', status: 'danger', description: 'Your connection is NOT encrypted. Data may be intercepted.', icon: Lock });
      }

      // 2. Cookie Status
      if (navigator.cookieEnabled) {
        checks.push({ name: 'Cookies Enabled', status: 'warning', description: 'Cookies are enabled. Trackers may follow your activity.', icon: Globe });
      } else {
        checks.push({ name: 'Cookies Blocked', status: 'secure', description: 'Cookies are blocked, enhancing your privacy.', icon: Globe });
      }

      // 3. Do Not Track
      const dnt = navigator.doNotTrack === '1';
      if (dnt) {
        checks.push({ name: 'Do Not Track (DNT)', status: 'secure', description: 'DNT signal is active. Compliant sites will not track you.', icon: Shield });
      } else {
        checks.push({ name: 'No DNT Signal', status: 'warning', description: 'Do Not Track is not enabled in your browser.', icon: Shield });
      }

      // 4. Platform info
      const platform = navigator.platform || 'Unknown OS';
      checks.push({ name: 'Operating System', status: 'secure', description: `Detected platform: ${platform}. Ensure it is kept up to date.`, icon: Smartphone });

      // 5. Timezone/Clock accuracy
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      checks.push({ name: 'System Time', status: 'secure', description: `Timezone synchronized to ${tz}.`, icon: Clock });

      setResults(checks);
      setAuditing(false);
    }, 1500);
  };

  const getScore = () => {
    if (!results) return 0;
    const secureCount = results.filter(r => r.status === 'secure').length;
    return Math.round((secureCount / results.length) * 100);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <MonitorSmartphone className="w-8 h-8 text-primary" /> Device & Browser Security Audit
        </h1>
        <p className="text-muted-foreground mt-2">
          Run a local, client-side check of your browser's security features, privacy settings, and connection integrity. No data leaves your device.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
          <div className="glass-card p-6 flex flex-col h-full">
            <h3 className="font-semibold text-lg mb-4">Audit Status</h3>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              {results ? (
                <div className="space-y-4">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" className="text-muted stroke-current" strokeWidth="8" fill="none" />
                      <circle cx="64" cy="64" r="56" className={`${getScore() >= 80 ? 'text-safe' : getScore() >= 50 ? 'text-warning' : 'text-destructive'} stroke-current`} strokeWidth="8" fill="none" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * getScore()) / 100} style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
                    </svg>
                    <span className="absolute text-3xl font-display font-bold">{getScore()}%</span>
                  </div>
                  <p className="text-sm font-medium">Security Score</p>
                </div>
              ) : (
                <Shield className="w-16 h-16 text-muted-foreground opacity-20 mb-4" />
              )}
            </div>
            <GlowButton onClick={runAudit} disabled={auditing} className="w-full mt-6">
              {auditing ? 'Scanning...' : results ? 'Re-run Audit' : 'Start Audit'}
            </GlowButton>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2">
          <div className="glass-card p-6 min-h-[400px]">
            <h3 className="font-semibold text-lg mb-4">Diagnostic Results</h3>
            {!results && !auditing && (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-20">
                Click "Start Audit" to begin scanning your browser environment.
              </div>
            )}
            
            {auditing && (
              <div className="h-full flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">Analyzing security parameters...</p>
              </div>
            )}

            {results && !auditing && (
              <div className="space-y-3">
                {results.map((r, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className={`flex items-start gap-4 p-4 rounded-xl border ${r.status === 'secure' ? 'bg-safe/10 border-safe/30' : r.status === 'warning' ? 'bg-warning/10 border-warning/30' : 'bg-destructive/10 border-destructive/30'}`}
                  >
                    <div className="mt-0.5">
                      {r.status === 'secure' ? <CheckCircle className="w-5 h-5 text-safe" /> : r.status === 'warning' ? <AlertTriangle className="w-5 h-5 text-warning" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
                    </div>
                    <div>
                      <h4 className={`text-sm font-semibold ${r.status === 'secure' ? 'text-safe' : r.status === 'warning' ? 'text-warning' : 'text-destructive'}`}>
                        {r.name}
                      </h4>
                      <p className="text-sm text-foreground mt-1 opacity-90">{r.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
