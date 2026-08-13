import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareText, ShieldAlert, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useScanEmail } from '@/hooks/api/useScans';
import { GlowButton } from '@/components/ui/GlowButton';

export default function SmsScanner() {
  const [smsContent, setSmsContent] = useState('');
  const [signals, setSignals] = useState<{ text: string; level: string; detail: string }[]>([]);

  const scanEmail = useScanEmail();

  const handleAnalyze = async () => {
    if (!smsContent) return;
    try {
      // We pass the SMS content to the email scanner using a hardcoded subject
      const result = await scanEmail.mutateAsync({ subject: 'SMS Message', body: smsContent });
      const score = Math.round(result.data.riskScore || 0);

      const parsedSignals = (result.data.emailHighlights || result.data.emailSignals || []).map(
        (s: { type?: string; text?: string; severity?: string; start?: string; reason?: string; color?: string }) => ({
          text: s.reason || s.type || 'Suspicious Pattern',
          level: s.severity === 'high' || s.severity === 'medium' ? 'danger' : s.severity === 'low' ? 'safe' : 'warning',
          detail: s.text || s.reason || '',
        })
      );

      if (parsedSignals.length === 0) {
        if (result.data.verdict === 'mailicious' || score >= 70) {
          parsedSignals.push({ text: 'High smishing risk detected', level: 'danger', detail: `ML score: ${score}%` });
        }
        parsedSignals.push({ text: result.data.verdict || 'Analysis complete', level: score >= 50 ? 'warning' : 'safe', detail: `Risk score: ${score}` });
      }

      setSignals(parsedSignals);
    } catch {
      setSignals([{ text: 'Analysis failed', level: 'danger', detail: 'Could not reach the ML service.' }]);
    }
  };

  const score = scanEmail.data ? Math.round(scanEmail.data.riskScore || 0) : 0;
  const analyzed = scanEmail.data !== undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
      {/* Left - Input */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 space-y-4 h-fit">
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-primary" /> SMS Smishing Scanner
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Paste a suspicious text message below. Our machine learning model will analyze the natural language for smishing (SMS phishing) patterns.
        </p>
        <textarea
          value={smsContent}
          onChange={e => setSmsContent(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none transition-all"
        />
        <GlowButton className="w-full" onClick={handleAnalyze} disabled={!smsContent || scanEmail.isPending}>
          {scanEmail.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing Message...</> : 'Scan Message'}
        </GlowButton>
      </motion.div>

      {/* Right - Results */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        {analyzed ? (
          <>
            <div className={`glass-card p-6 border-t-4 ${score >= 70 ? 'border-t-destructive' : score >= 40 ? 'border-t-warning' : 'border-t-safe'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Smishing Risk Score</p>
                  <p className={`text-4xl font-display font-bold ${score >= 70 ? 'text-destructive' : score >= 40 ? 'text-warning' : 'text-safe'}`}>
                    {score}%
                  </p>
                </div>
                {score >= 70 ? <ShieldAlert className="w-12 h-12 text-destructive opacity-20" /> : score >= 40 ? <AlertTriangle className="w-12 h-12 text-warning opacity-20" /> : <CheckCircle2 className="w-12 h-12 text-safe opacity-20" />}
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Detection Signals</h3>
              <div className="space-y-3">
                {signals.map((s, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${s.level === 'danger' ? 'bg-destructive/10 border-destructive/20 text-destructive' : s.level === 'warning' ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-safe/10 border-safe/20 text-safe'}`}>
                    <p className="text-sm font-medium">{s.text}</p>
                    <p className="text-xs opacity-80 mt-1">{s.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center h-full border-dashed">
            <MessageSquareText className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground text-sm">Paste a text message and click Scan to see the AI analysis results.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
