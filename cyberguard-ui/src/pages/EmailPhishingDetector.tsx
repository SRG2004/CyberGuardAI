import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, AlertCircle, CheckCircle, AlertTriangle, Info, Brain } from 'lucide-react';
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

      const parsedSignals = (result.data.xai_analysis || result.data.explainability || []).map(
        (s: { type?: string; text?: string; severity?: string; start?: string; reason?: string; color?: string }) => ({
          text: s.text || s.type || 'Unknown Signal',
          level: s.severity === 'high' || s.severity === 'medium' || s.severity === 'critical' ? 'danger' : s.severity === 'low' ? 'safe' : 'warning',
          detail: s.reason || s.text || '',
        })
      );

      // Fallback: derive signals from the response
      if (parsedSignals.length === 0) {
        if (result.data.verdict === 'phishing' || score >= 70) {
          parsedSignals.push({ text: 'High phishing risk detected', level: 'danger', detail: `ML score: ${score}%` });
        }
        parsedSignals.push({ text: result.data.verdict || 'Analysis complete', level: score >= 50 ? 'warning' : 'safe', detail: `Risk score: ${score}` });
      }

      setSignals(parsedSignals);
    } catch {
      setSignals([{ text: 'Analysis failed', level: 'danger', detail: 'Could not reach the ML service. Ensure backend is running.' }]);
    }
  };

  const score = scanEmail.data ? Math.round(scanEmail.data.data?.riskScore || 0) : 0;
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
          placeholder="Email Subject (optional)"
          className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all"
        />
        <textarea
          value={emailContent}
          onChange={e => setEmailContent(e.target.value)}
          rows={16}
          placeholder="Paste the email body content here to analyze for phishing signals..."
          className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground font-mono focus:outline-none focus:border-primary/50 resize-none transition-all"
        />
        <GlowButton onClick={handleAnalyze} className="w-full" size="lg" disabled={scanEmail.isPending}>
          {scanEmail.isPending ? 'Analyzing...' : 'Analyze Email'}
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

            {/* AI Reasoning (XAI) */}
            {(scanEmail.data?.data?.xai_analysis?.length > 0 || scanEmail.data?.data?.explainability?.length > 0) && (() => {
              const xaiData = scanEmail.data.data.xai_analysis || scanEmail.data.data.explainability || [];
              return (
              <div className="glass-card p-6">
                <h3 className="font-display font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Deep XAI Text Analysis
                </h3>
                
                {/* Highlighted Text Box */}
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground p-4 bg-muted/20 rounded-lg border border-border mb-4 max-h-60 overflow-y-auto">
                  {(() => {
                    const triggers = xaiData;
                    if (!triggers || triggers.length === 0) return <span>{emailContent}</span>;
                    const triggerWords = triggers.map((t: any) => t.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const regex = new RegExp(`(${triggerWords.join('|')})`, 'gi');
                    const parts = emailContent.split(regex);
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
                  {xaiData.map((exp: any, i: number) => {
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
              );
            })()}

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
