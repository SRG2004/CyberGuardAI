import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserCog, Users, Database, Activity, Brain, Plus, Search, CheckCircle, XCircle, AlertTriangle, ArrowUp } from 'lucide-react';
import { useAdminStats, useUsers, useChangeUserRole, useToggleUserStatus, useMlHealth, useRetrainModel } from '@/hooks/api/useAdmin';
import { useBlocklist, useAddBlocklistEntry, useDeleteBlocklistEntry } from '@/hooks/api/useBlocklist';
import { useReportQueue, useUpdateReportStatus } from '@/hooks/api/useReports';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';

const tabs = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'queue', label: 'Review Queue', icon: AlertTriangle },
  { id: 'blocklist', label: 'Blocklist', icon: Database },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'api', label: 'API Health', icon: Activity },
  { id: 'model', label: 'Model', icon: Brain },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [userPage, setUserPage] = useState(1);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState('');

  const statsQuery = useAdminStats();
  const usersQuery = useUsers(userPage) as unknown as {
    data?: { items?: Array<{ _id: string; email: string; displayName: string; role: string; isActive: boolean; scans?: number; lastActive: string }>; meta?: { page: number; total: number } };
    isLoading: boolean;
  };
  const healthQuery = useMlHealth() as unknown as {
    data?: { mlService?: { model_loaded?: boolean; accuracy?: number; uptime?: string }; uptime?: number };
    isLoading: boolean;
  };
  const blocklistQuery = useBlocklist() as unknown as {
    data?: { items?: Array<{ _id: string; domain: string; threatType: string; source: string; isActive: boolean; createdAt: string }>; meta?: { page: number; total: number } };
    isLoading: boolean;
  };
  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useReportQueue(1) as unknown as {
    data?: { items?: Array<{ _id: string; anonymousId: string; url?: string; description?: string; type: string; aiScore?: number; aiVerdict?: string; status: string; createdAt: string }>; meta?: { page: number; total: number } };
    isLoading: boolean;
    refetch: () => void;
  };

  const changeUserRole = useChangeUserRole();
  const toggleUserStatus = useToggleUserStatus();
  const addEntry = useAddBlocklistEntry();
  const deleteEntry = useDeleteBlocklistEntry();
  const retrainModel = useRetrainModel();
  const updateStatus = useUpdateReportStatus();

  const stats = statsQuery.data as Record<string, unknown> | undefined || {};
  const users = usersQuery.data?.items || [];
  const blocklist = blocklistQuery.data?.items || [];
  const mlHealth = healthQuery.data?.mlService as Record<string, unknown> | undefined || {};
  const reports = queueData?.items || [];

  const handleAddBlocklist = () => {
    if (!newDomain) return toast.error('Enter a domain');
    addEntry.mutate({ domain: newDomain, reason: newReason || 'Manually added', threatType: 'Other' }, {
      onSuccess: () => { setNewDomain(''); setNewReason(''); toast.success('Domain added to blocklist'); },
    });
  };

  const handleRetrain = () => {
    retrainModel.mutate(undefined, {
      onSuccess: () => toast.success('Model retrain initiated'),
      onError: () => toast.error('Model retrain failed'),
    });
  };

  const handleReportAction = (reportId: string, action: string) => {
    updateStatus.mutate({ reportId, status: action, notes: reportNotes || undefined }, {
      onSuccess: () => {
        toast.success(`Report ${action}`);
        setReportNotes('');
        refetchQueue();
      },
      onError: () => toast.error('Failed to update report'),
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary" /> Admin Panel
        </h2>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-xs rounded-md font-medium transition-all ${activeTab === t.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: String(stats.totalUsers || 0), change: `${stats.activeUsers || 0} active` },
            { label: 'Total Scans', value: String(stats.totalScans || 0), change: `+${stats.scansToday || 0} today` },
            { label: 'Threats Found', value: String(stats.totalThreats || 0), change: `+${stats.threatsToday || 0} today` },
            { label: 'Model Accuracy', value: mlHealth.accuracy ? `${(Number(mlHealth.accuracy) * 100).toFixed(1)}%` : 'N/A', change: mlHealth.model_loaded ? 'Model loaded' : 'Model not loaded' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="stat-number text-2xl text-primary mt-1">{s.value}</p>
              <p className="text-[10px] text-safe mt-1">{s.change}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Review Queue Tab */}
      {activeTab === 'queue' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            {queueLoading ? (
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
                onClick={() => { setSelectedReport(r._id); setReportNotes(''); }}
                className={`glass-card p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${selectedReport === r._id ? 'border-primary/50 shadow-glow-cyan' : ''}`}
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
                    <GlowButton size="sm" variant="ghost" onClick={() => handleReportAction(r._id, 'dismissed')}>
                      <XCircle className="w-3 h-3" />
                    </GlowButton>
                    <GlowButton size="sm" onClick={() => handleReportAction(r._id, 'confirmed')}>
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
          <div className="lg:col-span-2">
            <div className="glass-card p-5 sticky top-24">
              {selectedReport ? (
                <>
                  <h3 className="font-display font-semibold text-foreground text-sm mb-4">Report Detail</h3>
                  {(() => {
                    const r = reports.find(x => x._id === selectedReport);
                    if (!r) return <p className="text-xs text-muted-foreground">Report not found</p>;
                    return (
                      <div className="space-y-3">
                        <div><p className="text-[10px] text-muted-foreground">Report ID</p><p className="text-xs font-mono text-foreground">{r.anonymousId}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">URL</p><p className="text-xs font-mono text-foreground break-all">{r.url || 'N/A'}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Description</p><p className="text-xs text-foreground">{r.description || 'N/A'}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">AI Score</p><p className={`stat-number text-xl ${(r.aiScore || 0) >= 0.7 ? 'text-destructive' : 'text-warning'}`}>{Math.round(((r.aiScore || 0) * 100))}%</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Status</p><p className="text-xs capitalize text-foreground">{r.status.replace('_', ' ')}</p></div>
                        <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)} placeholder="Add notes..." rows={3} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
                        <div className="grid grid-cols-2 gap-2">
                          <GlowButton size="sm" className="w-full" onClick={() => handleReportAction(r._id, 'confirmed')}>
                            <CheckCircle className="w-3 h-3" /> Confirm
                          </GlowButton>
                          <GlowButton size="sm" variant="ghost" className="w-full" onClick={() => handleReportAction(r._id, 'under_review')}>
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
        </motion.div>
      )}

      {/* Blocklist Tab */}
      {activeTab === 'blocklist' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={newDomain} onChange={e => setNewDomain(e.target.value)}
                placeholder="Add domain to blocklist..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <input
              value={newReason} onChange={e => setNewReason(e.target.value)}
              placeholder="Reason (optional)"
              className="h-9 px-4 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
            />
            <GlowButton size="sm" onClick={handleAddBlocklist} disabled={addEntry.isPending}>
              <Plus className="w-4 h-4" /> Add
            </GlowButton>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border">
                {['Domain', 'Type', 'Source', 'Status', 'Date'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody>
                {blocklist.length > 0 ? blocklist.map((d, i) => (
                  <tr key={d._id || i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-foreground">{d.domain}</td>
                    <td className="px-4 py-3 text-xs text-destructive">{d.threatType}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{d.source}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{d.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No entries in blocklist</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              {['User', 'Email', 'Role', 'Status', 'Last Active', 'Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody>
              {users.length > 0 ? users.map((u) => (
                <tr key={u._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{u.displayName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => changeUserRole.mutate({ userId: u._id, role: e.target.value })}
                      className="px-2 py-0.5 text-[10px] font-medium rounded bg-muted/50 border border-border text-xs"
                    >
                      <option value="student">Student</option>

                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs ${u.isActive ? 'text-safe' : 'text-destructive'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastActive ? new Date(u.lastActive).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleUserStatus.mutate({ userId: u._id, isActive: !u.isActive })}
                      className={`text-xs px-2 py-0.5 rounded ${u.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-safe hover:bg-safe/10'}`}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {usersQuery.isLoading ? 'Loading users...' : 'No users found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* API Health Tab */}
      {activeTab === 'api' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'ML Inference', status: mlHealth?.model_loaded ? 'Online' : 'Offline', latency: mlHealth?.model_loaded ? 'Loaded' : 'N/A' },
            { name: 'Backend', status: 'Online', latency: `${Math.round(((healthQuery.data as Record<string, unknown>)?.uptime as number) || 0)}s uptime` },
          ].map((api, i) => (
            <div key={i} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-foreground">{api.name}</h4>
                <span className={`flex items-center gap-1.5 text-[10px] font-bold ${api.status === 'Online' ? 'text-safe' : 'text-warning'}`}>
                  <span className={`w-2 h-2 rounded-full ${api.status === 'Online' ? 'bg-safe' : 'bg-warning'}`} /> {api.status}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Latency: <span className="text-foreground">{api.latency}</span></span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Model Tab */}
      {activeTab === 'model' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Accuracy', value: mlHealth.accuracy ? `${(Number(mlHealth.accuracy) * 100).toFixed(1)}%` : 'N/A' },
              { label: 'Model Loaded', value: mlHealth.model_loaded ? 'Yes' : 'No' },
              { label: 'Retrain', value: retrainModel.isPending ? 'In Progress...' : 'Ready' },
            ].map(m => (
              <div key={m.label} className="text-center p-4 rounded-lg bg-muted/30">
                <p className="stat-number text-2xl text-primary">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </div>
            ))}
          </div>
          <GlowButton
            variant="danger" size="sm"
            onClick={handleRetrain}
            disabled={retrainModel.isPending}
          >
            <Brain className="w-4 h-4" /> {retrainModel.isPending ? 'Retraining...' : 'Trigger Retrain'}
          </GlowButton>
        </motion.div>
      )}
    </div>
  );
}
