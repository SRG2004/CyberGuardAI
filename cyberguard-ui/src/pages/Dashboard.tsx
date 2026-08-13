import { motion } from 'framer-motion';
import { AlertTriangle, Link as LinkIcon, Mail, Shield, Loader2, CheckCircle2, AlertCircle, MonitorSmartphone, MessageSquareText, FileSearch, Link2, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatWidget } from '@/components/ui/StatWidget';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GlowButton } from '@/components/ui/GlowButton';
import { useDashboardSummary, useTopDomains, useCategoryDistribution } from '@/hooks/api/useDashboard';
import { useLiveThreats, useTodayStats, useTimelineStats, useRadarData } from '@/hooks/api/useThreats';
import { useScanUrl } from '@/hooks/api/useScans';
import { getRiskColor, getRiskBg, getThreatTypeColor, getThreatTypeBg } from '@/lib/theme';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
} from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  PHISHING: '#FF3B5C',
  MALWARE: '#FF3B5C',
  SUSPICIOUS: '#FFB800',
  SPAM: '#FFB800',
  'FAKE_DOMAIN': '#FFB800',
  SAFE: '#00D4FF',
};

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[220px]">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">
      No {label} data available
    </div>
  );
}

export default function Dashboard() {
  const [quickUrl, setQuickUrl] = useState('');
  const navigate = useNavigate();

  // Dashboard summary
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useDashboardSummary();

  // Live threats (poll every 5s)
  const { data: liveThreats, isLoading: threatsLoading, error: threatsError } = useLiveThreats();

  // Today stats
  const { data: todayStats } = useTodayStats();

  // Charts
  const { data: timelineData, isLoading: timelineLoading } = useTimelineStats();
  const { data: radarData, isLoading: radarLoading } = useRadarData();
  const { data: topDomains, isLoading: domainsLoading } = useTopDomains();
  const { data: categoryData, isLoading: categoryLoading } = useCategoryDistribution();

  // Quick scan mutation
  const scanMutation = useScanUrl();

  const handleScan = () => {
    if (!quickUrl.trim()) return;
    let finalUrl = quickUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'http://' + finalUrl;
    }
    scanMutation.mutate({ url: finalUrl });
    setQuickUrl('');
  };

  const scanSuccess = scanMutation.isSuccess;
  const scanError = scanMutation.error;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5">
              <Skeleton className="h-4 w-24 mb-3 bg-muted/50" />
              <Skeleton className="h-8 w-16 mb-2 bg-muted/50" />
              <Skeleton className="h-3 w-32 bg-muted/50" />
            </div>
          ))
        ) : summaryError ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 flex items-center gap-2 text-destructive/80">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Data unavailable</span>
            </div>
          ))
        ) : (
          <>
            <StatWidget
              title="Threats Detected"
              value={summary?.threatsToday ?? 0}
              subtitle={`Total: ${summary?.totalThreats ?? 0}`}
              icon={AlertTriangle}
              color="red"
              delay={0}
            />
            <StatWidget
              title="URLs Scanned"
              value={summary?.scansToday ?? 0}
              subtitle="Real-time via extension"
              icon={LinkIcon}
              color="cyan"
              delay={0.1}
            />
            <StatWidget
              title="Emails Analyzed"
              value={summary?.emailsToday ?? 0}
              subtitle="Phishing detection active"
              icon={Mail}
              color="green"
              delay={0.2}
            />
            <StatWidget
              title="Risk Level"
              value={summary?.riskLevel === 'HIGH' ? 80 : summary?.riskLevel === 'MODERATE' ? 50 : 20}
              subtitle={`${summary?.riskLevel ?? '—'} — based on activity`}
              icon={Shield}
              color={summary?.riskLevel === 'HIGH' ? 'red' : summary?.riskLevel === 'MODERATE' ? 'amber' : 'green'}
              delay={0.3}
            />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-6">
          {/* Live Threat Feed */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
              <h3 className="font-display font-semibold text-foreground text-sm">Live Threats</h3>
              {threatsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
            </div>
            {threatsError ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
                <AlertCircle className="w-4 h-4" />
                Failed to load threats
              </div>
            ) : !liveThreats || liveThreats.length === 0 ? (
              <div className="text-muted-foreground text-xs text-center py-8">
                No threats detected — all clear
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {liveThreats.map((t, i) => (
                  <motion.div
                    key={t._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * Math.min(i, 10) }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getThreatTypeBg(t.type)}`}>
                      {t.type}
                    </Badge>
                    <span className="text-xs text-foreground font-mono truncate flex-1">
                      {t.url ?? t.emailSubject ?? t._id}
                    </span>
                    <span className={`text-xs font-bold ${getRiskColor(t.riskScore)}`}>
                      {t.riskScore}%
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getRiskBg(t.riskScore)}`}>
                      {t.verdict}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Timeline Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
            <h3 className="font-display font-semibold text-foreground text-sm mb-4">
              24-Hour Scan Timeline
              {todayStats && (
                <span className="ml-2 text-muted-foreground font-normal text-xs">
                  — Today: {todayStats.totalScans ?? 0} scans
                  {todayStats.phishing ? ` · ${todayStats.phishing} phishing` : ''}
                </span>
              )}
            </h3>
            {timelineLoading ? (
              <ChartSkeleton />
            ) : !timelineData || timelineData.length === 0 ? (
              <EmptyChart label="timeline" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF3B5C" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#FF3B5C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fill: '#7A9CC0', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fill: '#7A9CC0', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0F1629', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#E8F4FD' }}
                  />
                  <Area type="monotone" dataKey="scans" stroke="#00D4FF" fill="url(#gradCyan)" strokeWidth={2} />
                  <Area type="monotone" dataKey="threats" stroke="#FF3B5C" fill="url(#gradRed)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Radar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
            <h3 className="font-display font-semibold text-foreground text-sm mb-4">Threat Radar</h3>
            {radarLoading ? (
              <div className="flex items-center justify-center h-[240px]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !radarData || radarData.length === 0 ? (
              <EmptyChart label="radar" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(0,212,255,0.15)" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#7A9CC0', fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Top Risky Domains */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
            <h3 className="font-display font-semibold text-foreground text-sm mb-4">Top Risky Domains</h3>
            {domainsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-3 flex-1 bg-muted/50" />
                    <Skeleton className="h-1.5 w-20 bg-muted/50" />
                    <Skeleton className="h-3 w-8 bg-muted/50" />
                  </div>
                ))}
              </div>
            ) : !topDomains || topDomains.length === 0 ? (
              <div className="text-muted-foreground text-xs text-center py-6">No risky domains found</div>
            ) : (
              <div className="space-y-3">
                {topDomains.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-foreground flex-1 truncate">{d.domain}</span>
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${d.riskScore >= 90 ? 'bg-destructive' : d.riskScore >= 70 ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${d.riskScore}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${getRiskColor(d.riskScore)}`}>{d.riskScore}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick Scan */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
            <h3 className="font-display font-semibold text-foreground text-sm mb-3">Quick Scan</h3>
            <div className="flex gap-2">
              <input
                value={quickUrl}
                onChange={e => setQuickUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleScan(); }}
                placeholder="Paste URL here..."
                disabled={scanMutation.isPending}
                className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50"
              />
              <GlowButton
                size="sm"
                onClick={handleScan}
                disabled={scanMutation.isPending || !quickUrl.trim()}
              >
                {scanMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Scan'
                )}
              </GlowButton>
            </div>
            {scanSuccess && (
              <div className="mt-2 flex items-center gap-1.5 text-safe text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Scan complete — {scanMutation.data?.data?.verdict} ({scanMutation.data?.data?.riskScore}%)
              </div>
            )}
            {scanError && (
              <div className="mt-2 flex items-center gap-1.5 text-destructive text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {scanError instanceof Error ? scanError.message : 'Scan failed'}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
          <h3 className="font-display font-semibold text-foreground text-sm mb-4">Threat Categories</h3>
          {categoryLoading ? (
            <ChartSkeleton />
          ) : !categoryData || categoryData.length === 0 ? (
            <EmptyChart label="category" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="category"
                    stroke="none"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={CATEGORY_COLORS[entry.category?.toUpperCase()] || '#00D4FF'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0F1629', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {categoryData.map(c => (
                  <span key={c.category} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[c.category?.toUpperCase()] || '#00D4FF' }} />
                    {c.category}
                  </span>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* System Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold text-foreground text-sm mb-4">System Status</h3>
          {summaryLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                  <Skeleton className="w-2 h-2 rounded-full bg-muted/50" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2 w-20 bg-muted/50" />
                    <Skeleton className="h-3 w-14 bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Google Safe Browsing', status: 'Online', ok: true },
                { label: 'VirusTotal API', status: 'Online', ok: true },
                { label: 'ML Model v2.4', status: 'Active', ok: true },
                {
                  label: 'Threats Blocked Today',
                  status: summary ? String(summary.threatsToday) : '—',
                  ok: true,
                },
                {
                  label: 'Total Known Threats',
                  status: summary ? String(summary.totalThreats) : '—',
                  ok: true,
                },
                {
                  label: 'Current Risk Level',
                  status: summary?.riskLevel ?? '—',
                  ok: true,
                },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                  <span className={`w-2 h-2 rounded-full ${s.ok ? 'bg-safe' : 'bg-destructive'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="text-xs font-medium text-foreground">{s.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      {/* Quick Tools */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="glass-card p-5">
        <h3 className="font-display font-semibold text-foreground text-sm mb-4">Quick Security Tools</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button onClick={() => navigate('/sms-scanner')} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all">
            <MessageSquareText className="w-6 h-6 text-primary" />
            <span className="text-xs font-semibold text-foreground">SMS Scanner</span>
          </button>
          <button onClick={() => navigate('/device-audit')} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all">
            <MonitorSmartphone className="w-6 h-6 text-primary" />
            <span className="text-xs font-semibold text-foreground">Device Audit</span>
          </button>
          <button onClick={() => navigate('/file-analyzer')} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all">
            <FileSearch className="w-6 h-6 text-primary" />
            <span className="text-xs font-semibold text-foreground">File Analyzer</span>
          </button>
          <button onClick={() => navigate('/unshortener')} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all">
            <Link2 className="w-6 h-6 text-primary" />
            <span className="text-xs font-semibold text-foreground">URL Tracer</span>
          </button>
          <button onClick={() => navigate('/header-analyzer')} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all">
            <Fingerprint className="w-6 h-6 text-primary" />
            <span className="text-xs font-semibold text-foreground">Header Spoof</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
