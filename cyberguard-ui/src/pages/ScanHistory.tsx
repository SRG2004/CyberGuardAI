import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Download, ExternalLink } from 'lucide-react';
import { useScanHistory } from '@/hooks/api/useScans';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { GlowButton } from '@/components/ui/GlowButton';

const riskColor = (score: number) => {
  if (score >= 80) return 'text-destructive';
  if (score >= 50) return 'text-warning';
  if (score >= 20) return 'text-primary';
  return 'text-safe';
};

export default function ScanHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useScanHistory(page, 20) as unknown as {
    data?: { items?: Array<{ _id: string; input: string; inputType: string; result: { riskScore: number; verdict: string; type: string; createdAt?: string }; createdAt: string }>; meta?: { page: number; total: number } };
    isLoading: boolean;
    isError: boolean;
  };
  const items = data?.items || [];
  const total = data?.meta?.total || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Scan History
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isLoading ? 'Loading...' : `${total} total scans`}
          </p>
        </div>
        <GlowButton variant="ghost" size="sm"><Download className="w-4 h-4" /> Export CSV</GlowButton>
      </motion.div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground text-sm">Loading scan history...</p>
        </div>
      ) : isError ? (
        <div className="glass-card p-12 text-center">
          <p className="text-destructive text-sm">Failed to load scan history.</p>
        </div>
      ) : items.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['URL', 'Date', 'Risk', 'Type', 'Verdict', 'Source', 'Duration'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((s, i) => (
                  <motion.tr
                    key={s._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-foreground max-w-[200px] truncate">{s.input}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`stat-number text-sm ${riskColor(s.result?.riskScore || 0)}`}>{Math.round(s.result?.riskScore || 0)}</span></td>
                    <td className="px-4 py-3"><RiskBadge type={s.result?.type || 'SAFE'} /></td>
                    <td className="px-4 py-3"><span className={`text-xs ${s.result?.verdict === 'malicious' ? 'text-destructive' : s.result?.verdict === 'suspicious' ? 'text-warning' : 'text-safe'}`}>{s.result?.verdict || 'unknown'}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.source || 'ml'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.durationMs ? `${s.durationMs}ms` : '-'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-xs rounded bg-muted/30 disabled:opacity-50">Previous</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-3 py-1 text-xs rounded bg-muted/30 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-12 text-center">
          <p className="text-muted-foreground text-sm">No scan history found. Start scanning URLs to see records here.</p>
        </motion.div>
      )}
    </div>
  );
}
