import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Shield, FileDown, Flag, Brain } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';
import { useScanUrl } from '@/hooks/api/useScans';
import { getRiskColor } from '@/lib/theme';
import { toast } from 'sonner';

export default function LinkScanner() {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();

  const scan = useScanUrl();

  const handleScan = async () => {
    if (!url || scan.isPending) return;
    try {
      let finalUrl = url.replace(/\s+/g, '');
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'http://' + finalUrl;
      }
      await scan.mutateAsync({ url: finalUrl });
      toast.success('Scan complete');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">URL Threat Scanner</h2>
        <p className="text-sm text-muted-foreground mb-6">Analyze any URL against our ML-powered threat detection model</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value.replace(/\s+/g, ''))}
              className="w-full h-14 pl-12 pr-4 rounded-xl bg-background border border-border text-foreground font-mono text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              onKeyDown={e => e.key === 'Enter' && handleScan()}
            />
          </div>
          <GlowButton size="lg" onClick={handleScan} disabled={scan.isPending || !url}>
            {scan.isPending ? 'Scanning...' : 'Scan URL'}
          </GlowButton>
        </div>
        {scan.isError && (
          <p className="text-sm text-destructive mt-2">
            {scan.error instanceof Error ? scan.error.message : 'Scan failed'}
          </p>
        )}
      </motion.div>

      {/* Results */}
      {scan.data && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
          <div className="glass-card p-8 text-center">
            <div className="relative w-40 h-40 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="80" cy="80" r="70" fill="none"
                  stroke={scan.data.data.riskScore >= 80 ? '#FF3B5C' : scan.data.data.riskScore >= 50 ? '#FFB800' : '#00FF88'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${scan.data.data.riskScore * 4.4} 440`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`stat-number text-4xl ${getRiskColor(scan.data.data.riskScore)}`}>{scan.data.data.riskScore}</span>
                <span className={`text-xs font-bold ${getRiskColor(scan.data.data.riskScore)}`}>{scan.data.data.verdict.toUpperCase()}</span>
              </div>
            </div>
            <p className="font-mono text-sm text-muted-foreground">{scan.data.data.input}</p>
            {scan.data.data.sources?.mlModel && (
              <p className="text-xs text-muted-foreground mt-2">
                ML Probability: {scan.data.data.sources.mlModel.probability} • Features: {scan.data.data.sources.mlModel.features.join(', ') || 'none highlighted'}
              </p>
            )}
          </div>

          {/* Analysis Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'ML Model Score', value: `Probability: ${scan.data.data.sources?.mlModel?.probability || 0}` },
              { label: 'Verdict', value: scan.data.data.verdict.toUpperCase() },
              { label: 'Scan Duration', value: `${scan.data.data.durationMs}ms` },
              { label: 'Scan ID', value: scan.data.data.scanId },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <p className={`text-sm font-semibold font-mono ${item.label === 'Verdict' ? getRiskColor(scan.data.data.riskScore) : 'text-foreground'}`}>{item.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Explainability (XAI) */}
          {scan.data.data.sources?.mlModel?.explainability?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
              <h3 className="font-display font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> AI Reasoning (XAI)
              </h3>
              <div className="space-y-2">
                {scan.data.data.sources.mlModel.explainability.map((exp: string, i: number) => {
                  const isPos = exp.trim().startsWith('+');
                  return (
                    <div key={i} className={`text-sm p-3 rounded-lg border flex items-start gap-2 ${isPos ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-safe/10 border-safe/20 text-safe'}`}>
                      <span className="font-mono mt-0.5">{isPos ? '▲' : '▼'}</span>
                      <span>{exp.replace(/^[+-]/, '').trim()}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <GlowButton variant="danger" size="sm" onClick={() => navigate('/report')}>
              <Flag className="w-4 h-4" /> Report
            </GlowButton>
            <GlowButton variant="ghost" size="sm">
              <FileDown className="w-4 h-4" /> Download Report
            </GlowButton>
          </div>
        </motion.div>
      )}
    </div>
  );
}
