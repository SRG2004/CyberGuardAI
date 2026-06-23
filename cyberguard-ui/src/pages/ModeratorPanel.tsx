import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, CheckCircle, XCircle, AlertTriangle, ArrowUp } from 'lucide-react';
import { useReportQueue, useUpdateReportStatus } from '@/hooks/api/useReports';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';

export default function ModeratorPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useReportQueue(page) as unknown as {
    data?: { items?: Array<{ _id: string; anonymousId: string; url?: string; description?: string; type: string; aiScore?: number; aiVerdict?: string; status: string; createdAt: string }>; meta?: { page: number; total: number } };
    isLoading: boolean;
  };
  const updateStatus = useUpdateReportStatus();

  const reports = data?.items || [];
  const total = data?.meta?.total || 0;

  const handleAction = (reportId: string, action: string) => {
    updateStatus.mutate({ reportId, status: action, notes: notes || undefined }, {
      onSuccess: () => {
        toast.success(`Report ${action}`);
        setNotes('');
        refetch();
      },
      onError: () => {
        toast.error('Failed to update report');
      },
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Review Queue
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {isLoading ? 'Loading...' : `${total} reports pending review`}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Queue */}
        <div className="lg:col-span-3 space-y-3">
          {isLoading ? (
            <div className="glass-card p-12 text-center">
              <p className="text-muted-foreground text-sm">Loading reports...</p>
            </div>
          ) : reports.length > 0 ? reports.map((r) => {
            const type = r.type?.toUpperCase() || 'PHISHING';
            const normalizedType = (['PHISHING', 'MALWARE', 'SUSPICIOUS'].includes(type) ? type : 'SUSPICIOUS') as 'PHISHING' | 'MALWARE' | 'SUSPICIOUS';
            return (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => { setSelected(r._id); setNotes(''); }}
              className={`glass-card p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${selected === r._id ? 'border-primary/50 shadow-glow-cyan' : ''}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-muted-foreground">{r.anonymousId}</span>
                <RiskBadge type={normalizedType} />
                <span className="text-xs text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm font-mono text-foreground">{r.url || 'No URL provided'}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">AI: <span className={(r.aiScore || 0) >= 0.7 ? 'text-destructive' : 'text-warning'}>{Math.round(((r.aiScore || 0) * 100))}% risk</span></span>
                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  <GlowButton size="sm" variant="ghost" onClick={() => handleAction(r._id, 'dismissed')}>
                    <XCircle className="w-3 h-3" />
                  </GlowButton>
                  <GlowButton size="sm" onClick={() => handleAction(r._id, 'confirmed')}>
                    <CheckCircle className="w-3 h-3" />
                  </GlowButton>
                </div>
              </div>
            </motion.div>
          );
          }) : (
            <div className="glass-card p-12 text-center">
              <p className="text-muted-foreground text-sm">No reports pending review</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          <div className="glass-card p-5 sticky top-24">
            {selected ? (
              <>
                <h3 className="font-display font-semibold text-foreground text-sm mb-4">Report Detail</h3>
                {(() => {
                  const r = reports.find(x => x._id === selected);
                  if (!r) return <p className="text-xs text-muted-foreground">Report not found</p>;
                  return (
                    <div className="space-y-3">
                      <div><p className="text-[10px] text-muted-foreground">Report ID</p><p className="text-xs font-mono text-foreground">{r.anonymousId}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">URL</p><p className="text-xs font-mono text-foreground break-all">{r.url || 'N/A'}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Description</p><p className="text-xs text-foreground">{r.description || 'N/A'}</p></div>
                      <div><p className="text-[10px] text-muted-foreground">AI Score</p><p className={`stat-number text-xl ${(r.aiScore || 0) >= 0.7 ? 'text-destructive' : 'text-warning'}`}>{Math.round(((r.aiScore || 0) * 100))}%</p></div>
                      <div><p className="text-[10px] text-muted-foreground">Status</p><p className="text-xs capitalize text-foreground">{r.status.replace('_', ' ')}</p></div>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." rows={3} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
                      <div className="grid grid-cols-2 gap-2">
                        <GlowButton size="sm" className="w-full" onClick={() => handleAction(r._id, 'confirmed')}>
                          <CheckCircle className="w-3 h-3" /> Confirm
                        </GlowButton>
                        <GlowButton size="sm" variant="ghost" className="w-full" onClick={() => handleAction(r._id, 'under_review')}>
                          <ArrowUp className="w-3 h-3" /> Escalate
                        </GlowButton>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Select a report to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
