import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareText, AlertCircle, CheckCircle2, AlertTriangle, Loader2, Brain, ShieldAlert } from 'lucide-react';
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

      const parsedSignals = (result.data.explainability || []).map(
        (s: any) => ({
          text: s.text || s.type || 'Suspicious Pattern',
          level: s.severity === 'high' || s.severity === 'medium' || s.severity === 'critical' ? 'danger' : s.severity === 'low' ? 'safe' : 'warning',
          detail: s.reason || '',
        })
      );

      if (parsedSignals.length === 0) {
        if (result.data.verdict === 'phishing' || score >= 70) {
          parsedSignals.push({ text: 'High smishing risk detected', level: 'danger', detail: `ML score: ${score}%` });
        }
        parsedSignals.push({ text: result.data.verdict || 'Analysis complete', level: score >= 50 ? 'warning' : 'safe', detail: `Risk score: ${score}` });
      }

      setSignals(parsedSignals);
    } catch {
      setSignals([{ text: 'Analysis failed', level: 'danger', detail: 'Could not reach the ML service.' }]);
    }
  };

  const score = scanEmail.data ? Math.round(scanEmail.data.data?.riskScore || 0) : 0;
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

            {/* AI Reasoning (XAI) */}
            {scanEmail.data?.data?.explainability?.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="font-display font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Deep XAI Text Analysis
                </h3>
                
                {/* Highlighted Text Box */}
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground p-4 bg-muted/20 rounded-lg border border-border mb-4 max-h-60 overflow-y-auto">
                  {(() => {
                    const triggers = scanEmail.data.data.explainability;
                    if (!triggers || triggers.length === 0) return <span>{smsContent}</span>;
                    const triggerWords = triggers.map((t: any) => t.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const regex = new RegExp(`(${triggerWords.join('|')})`, 'gi');
                    const parts = smsContent.split(regex);
                    return parts.map((part: string, i: number) => {
                      const isTrigger = triggers.some((t: any) => t.text.toLowerCase() === part.toLowerCase());
                      if (isTrigger) {
                        const info = triggers.find((t: any) => t.text.toLowerCase() === part.toLowerCase());
                        return (
                          <span key={i} title={info?.reason} className="bg-destructive/20 text-destructive font-bold px-1 py-0.5 rounded border border-destructive/30 shadow-[0_0_10px_rgba(239,68,68,0.3)] cursor-help">
                            {part}
                          </span>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    });
                  })()}
                </div>

                <div className="space-y-2">
                  {scanEmail.data.data.explainability.map((exp: any, i: number) => {
                    return (
                      <div key={i} className={`text-sm p-3 rounded-lg border flex items-start gap-2 bg-destructive/10 border-destructive/20 text-destructive`}>
                        <span className="font-mono mt-0.5">▲</span>
                        <div>
                           <p className="font-bold">{exp.text} <span className="font-normal text-xs opacity-70 ml-2">({exp.type})</span></p>
                           <p className="text-xs opacity-80 mt-1">{exp.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
