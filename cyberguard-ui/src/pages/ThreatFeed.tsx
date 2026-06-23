import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Filter } from 'lucide-react';
import { useThreats } from '@/hooks/api/useThreats';
import { RiskBadge } from '@/components/ui/RiskBadge';

const filters = ['ALL', 'PHISHING', 'MALWARE', 'SUSPICIOUS'] as const;
const timeRanges = ['1H', '24H', '7D', '30D'];

export default function ThreatFeed() {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [activeRange, setActiveRange] = useState('24H');

  const filterParams: { type?: string } = {};
  if (activeFilter !== 'ALL') filterParams.type = activeFilter;

  const { data, isLoading } = useThreats(page, filterParams);
  const items = (data as unknown as { items?: unknown[] })?.items || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" /> Global Threat Feed
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isLoading ? 'Loading...' : (
                <><span className="stat-number text-primary">{Array.isArray(items) ? items.length : 0}</span> threats loaded</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {timeRanges.map(r => (
              <button
                key={r}
                onClick={() => setActiveRange(r)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${activeRange === r ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground bg-muted/30'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {filters.map(f => (
          <button
            key={f}
            onClick={() => { setActiveFilter(f); setPage(1); }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${activeFilter === f ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground bg-muted/30 border border-transparent'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground text-sm">Loading threats...</p>
        </div>
      ) : Array.isArray(items) && items.length > 0 ? (
        <div className="space-y-3">
          {(items as { type: string; url?: string; emailSubject?: string; riskScore: number; verdict: string; createdAt: string }[]).map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-muted-foreground w-32 shrink-0">{new Date(t.createdAt).toLocaleTimeString()}</span>
                <RiskBadge type={t.type.toUpperCase() as 'PHISHING' | 'MALWARE' | 'SUSPICIOUS'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{t.url || t.emailSubject || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{t.verdict}</p>
                </div>
                <div className="text-right">
                  <p className={`stat-number text-lg ${t.riskScore >= 80 ? 'text-destructive' : t.riskScore >= 50 ? 'text-warning' : 'text-safe'}`}>
                    {Math.round(t.riskScore)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">risk</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground text-sm">No threats found matching current filters.</p>
        </div>
      )}
    </div>
  );
}
