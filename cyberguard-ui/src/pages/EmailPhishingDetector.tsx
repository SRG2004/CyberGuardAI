import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useScanEmail } from '@/hooks/api/useScans';
import { GlowButton } from '@/components/ui/GlowButton';

const iconMap = { danger: AlertCircle, warning: AlertTriangle, safe: CheckCircle } as const;
const colorMap = { danger: 'text-destructive', warning: 'text-warning', safe: 'text-safe' } as const;
const bgMap = { danger: 'bg-destructive/10', warning: 'bg-warning/10', safe: 'bg-safe/10' } as const;

export default function EmailPhishingDetector() {
  const [emailContent, setEmailContent] = useState('');
  const [subject, setSubject] = useState('');
  const [signals, setSignals] = useState<{ text: string; level: string; detail: string }[]>([]);

  const scanEmail = useScanEmail();

  const handleAnalyze = async () => {
    if (!emailContent) return;
    try {
      const result = await scanEmail.mutateAsync({ subject, body: emailContent });
      const score = Math.round(result.data.riskScore || 0);

      const parsedSignals = (result.data.emailHighlights || result.data.emailSignals || []).map(
        (s: { type?: string; text?: string; severity?: string; start?: string; reason?: string; color?: string }) => ({
          text: s.reason || s.type || 'Unknown Signal',
          level: s.severity === 'high' || s.severity === 'medium' ? 'danger' : s.severity === 'low' ? 'safe' : 'warning',
          detail: s.text || s.reason || '',
        })
      );

      // Fallback: derive signals from the response
      if (parsedSignals.length === 0) {
        if (result.data.verdict === 'mailicious' || score >= 70) {
          parsedSignals.push({ text: 'High phishing risk detected', level: 'danger', detail: `ML score: ${score}%` });
        }
        parsedSignals.push({ text: result.data.verdict || 'Analysis complete', level: score >= 50 ? 'warning' : 'safe', detail: `Risk score: ${score}` });
      }

      setSignals(parsedSignals);
    } catch {
      setSignals([{ text: 'Analysis failed', level: 'danger', detail: 'Could not reach the ML service. Ensure backend is running.' }]);
    }
  };

  const score = scanEmail.data ? Math.round(scanEmail.data.riskScore || 0) : 0;
  const analyzed = scanEmail.data !== undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
      {/* Left - Input */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 space-y-4">
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> Email Content
        </h2>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors"
        />
        <textarea
          value={emailContent}
          onChange={e => setEmailContent(e.target.value)}
          className="w-full h-full min-h-[200px] p-4 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
        />
        <GlowButton onClick={handleAnalyze} className="w-full" size="lg" disabled={scanEmail.isLoading}>
          {scanEmail.isLoading ? 'Analyzing...' : 'Analyze Email'}
        </GlowButton>
      </motion.div>

      {/* Right - Results */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        {analyzed ? (
          <>
            {/* Score */}
            <div className="glass-card p-6 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Phishing Probability</p>
              <div className={`stat-number text-6xl ${score >= 70 ? 'text-destructive text-glow-red' : score >= 50 ? 'text-warning' : 'text-safe text-glow-green'}`}>
                {score}%
              </div>
              <p className={`text-sm font-semibold mt-1 ${score >= 70 ? 'text-destructive' : score >= 50 ? 'text-warning' : 'text-safe'}`}>
                {score >= 70 ? 'HIGH RISK — Likely Phishing' : score >= 50 ? 'MODERATE — Suspicious Content' : 'LOW RISK — Appears Legitimate'}
              </p>
            </div>

            {/* Signals */}
            <div className="glass-card p-6">
              <h3 className="font-display font-semibold text-foreground text-sm mb-4">Detected Signals</h3>
              <div className="space-y-3">
                {signals.map((s, i) => {
                  const Icon = iconMap[s.level as keyof typeof iconMap] || Info;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-start gap-3 p-3 rounded-lg ${bgMap[s.level as keyof typeof bgMap]}`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 ${colorMap[s.level as keyof typeof colorMap]} shrink-0`} />
                      <div>
                        <p className={`text-sm font-medium ${colorMap[s.level as keyof typeof colorMap]}`}>{s.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{s.detail}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="glass-card p-12 text-center">
            <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">Paste email content and click Analyze to detect phishing attempts</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
