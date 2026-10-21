import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  Search,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Link as LinkIcon,
  CornerDownRight,
  Terminal,
  Copy,
  Check,
  RotateCw,
  Globe,
  Laptop,
  ShieldCheck,
  Activity,
  Layers,
  Zap,
  Info,
  Server,
  Network,
  Cpu
} from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';
import api from '@/lib/api';
import { runClientTraceroute, initBrowserConsoleTracertHelper, extractHostname } from '@/lib/traceroute';
import { analyzeTraceroute, HopData } from '@/lib/routeAnalyzer';

type UnshortenResult = {
  originalUrl: string;
  finalUrl: string;
  hops: string[];
  redirectCount: number;
};

export default function UrlUnshortener() {
  const location = useLocation();
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<UnshortenResult | null>(null);
  const [traceroute, setTraceroute] = useState<string | null>(null);
  const [isTracingRoute, setIsTracingRoute] = useState(false);
  const [traceProgress, setTraceProgress] = useState<string>('Ready');
  const [traceSource, setTraceSource] = useState<'browser-client' | 'backend-fallback' | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activeTab, setActiveTab] = useState<'smart' | 'raw'>('smart');

  useEffect(() => {
    // Mount browser console helper so user can run tracert() inside F12 DevTools console
    initBrowserConsoleTracertHelper();

    if (location.state?.url) {
      setUrl(location.state.url);
    }
  }, [location.state]);

  const executeTraceroute = async (destinationUrl: string) => {
    setIsTracingRoute(true);
    setTraceProgress('Starting browser traceroute probe...');
    
    try {
      const res = await runClientTraceroute(destinationUrl, (status) => {
        setTraceProgress(status);
      });
      setTraceroute(res.rawOutput);
      setTraceSource(res.source);
    } catch {
      setTraceroute('Traceroute failed to complete.');
    } finally {
      setIsTracingRoute(false);
    }
  };

  const handleAnalyze = async () => {
    if (!url) return;
    
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    setIsAnalyzing(true);
    setResult(null);
    setTraceroute(null);
    setTraceSource(null);

    try {
      const response = await api.post<UnshortenResult>('/api/tools/unshorten', { url: targetUrl });
      if (response.data) {
        setResult(response.data);
        executeTraceroute(response.data.finalUrl);
      }
    } catch (err: any) {
      toast.error('Analysis failed', { description: err.message || 'Network error occurred.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyCliCommand = (hostname: string) => {
    const cmd = `tracert ${hostname}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    toast.success('Copied terminal command', {
      description: `Run "${cmd}" in Windows Command Prompt, or "traceroute ${hostname}" on macOS/Linux.`,
    });
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const finalHostname = result?.finalUrl ? extractHostname(result.finalUrl) : '';

  // Parse and synthesize high-level intelligence from raw traceroute logs
  const analysis = useMemo(() => {
    if (!traceroute) return null;
    return analyzeTraceroute(traceroute, finalHostname);
  }, [traceroute, finalHostname]);

  const getCategoryBadgeClass = (category: HopData['category']) => {
    switch (category) {
      case 'local':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'cdn':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'transit':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'destination':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'firewall':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getLatencyBadge = (rtt: number | null, isTimeout: boolean) => {
    if (isTimeout || rtt === null) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted/60 text-muted-foreground border border-border">Filtered</span>;
    }
    if (rtt < 25) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{rtt} ms</span>;
    }
    if (rtt < 85) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{rtt} ms</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">{rtt} ms</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <Link2 className="w-8 h-8 text-primary" /> URL Unshortener & Network Route Tracer
        </h1>
        <p className="text-muted-foreground mt-2">
          Safely reveal the final destination of shortened or obfuscated links and synthesize deep network route intelligence with live hop diagnostics.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left - Input */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6 h-fit">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" /> Inspect Link
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Suspicious URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="e.g. bit.ly/3xyz or target-domain.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <GlowButton className="w-full" onClick={handleAnalyze} disabled={!url || isAnalyzing}>
                {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Tracing...</> : 'Trace Route'}
              </GlowButton>
            </div>
          </div>
          
          <div className="glass-card p-4 border border-warning/20 bg-warning/5">
             <div className="flex items-start gap-3">
               <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
               <p className="text-xs text-muted-foreground">
                 <span className="font-semibold text-warning">Security Tip:</span> Threat actors use URL shorteners to hide malicious destinations. Always trace links from unknown senders before clicking.
               </p>
             </div>
          </div>

          <div className="glass-card p-4 border border-primary/20 bg-primary/5">
             <div className="flex items-start gap-3">
               <Terminal className="w-5 h-5 text-primary shrink-0 mt-0.5" />
               <p className="text-xs text-muted-foreground">
                 <span className="font-semibold text-primary">Live DevTools Console:</span> Packets are logged in real-time to your Browser Developer Console (<kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">F12</kbd> &rarr; Console). You can also type <code className="text-primary font-mono text-[11px]">tracert()</code> directly in the console.
               </p>
             </div>
          </div>
        </motion.div>

        {/* Right - Results */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-3">
          <div className="glass-card p-6 h-full min-h-[380px]">
            <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" /> Redirect Chain
            </h3>

            {!result && !isAnalyzing && (
              <div className="flex flex-col items-center justify-center text-center h-[240px] opacity-50">
                <LinkIcon className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Enter a URL to see its redirect path and network hops.</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center text-center h-[240px]">
                <Loader2 className="w-12 h-12 mb-4 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">Following redirects safely...</p>
              </div>
            )}

            {result && !isAnalyzing && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final Destination</p>
                    <span className="px-2 py-0.5 bg-safe/10 text-safe text-[10px] font-bold rounded">Resolved</span>
                  </div>
                  <p className="text-sm font-medium text-foreground break-all">{result.finalUrl}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Hop History ({result.redirectCount} redirects)</h4>
                  <div className="space-y-0 pl-2">
                    {result.hops.map((hop, index) => (
                      <div key={index} className="relative pl-6 pb-6 last:pb-0">
                        {index !== result.hops.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border/50" />
                        )}
                        
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center z-10">
                          {index === 0 ? (
                            <LinkIcon className="w-3 h-3 text-muted-foreground" />
                          ) : index === result.hops.length - 1 ? (
                            <CheckCircle2 className="w-3 h-3 text-safe" />
                          ) : (
                            <CornerDownRight className="w-3 h-3 text-primary" />
                          )}
                        </div>

                        <div className="pt-1">
                          <p className={`text-xs break-all ${index === result.hops.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                            {hop}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Deep Network Route Intelligence Section */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-card p-6 md:p-8 space-y-6">
              
              {/* Header with Title & Action Controls */}
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/50 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Network className="w-6 h-6 text-primary" />
                    <h2 className="font-display text-xl font-bold text-foreground">
                      Deep Network Route Intelligence
                    </h2>
                    {traceSource === 'browser-client' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live Client Probe
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Structured hop-by-hop latency profiling, CDN edge detection, and transit provider analysis.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Switcher Pills */}
                  <div className="bg-muted/80 p-1 rounded-lg flex items-center gap-1 border border-border">
                    <button
                      type="button"
                      onClick={() => setActiveTab('smart')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        activeTab === 'smart'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Smart Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('raw')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        activeTab === 'raw'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Raw Terminal
                    </button>
                  </div>

                  {finalHostname && (
                    <button
                      type="button"
                      onClick={() => handleCopyCliCommand(finalHostname)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors border border-border"
                      title="Copy tracert command for your local command prompt"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span>tracert {finalHostname}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => executeTraceroute(result.finalUrl)}
                    disabled={isTracingRoute}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors border border-border disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isTracingRoute ? 'animate-spin' : ''}`} />
                    <span>Re-trace</span>
                  </button>
                </div>
              </div>

              {/* Progress Loading State */}
              {isTracingRoute && (
                <div className="p-8 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-foreground">{traceProgress}</p>
                  <p className="text-xs text-muted-foreground">
                    Dispatching distributed packets across edge nodes. Open DevTools Console (F12) to see raw packets streaming...
                  </p>
                </div>
              )}

              {/* Main Analyzed Content */}
              {!isTracingRoute && analysis && (
                <div className="space-y-6">

                  {/* 1. Executive Route Story Banner */}
                  <div className="p-5 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
                    <div className="flex items-start gap-3.5">
                      <Cpu className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                          Synthesized Route Journey
                        </h4>
                        <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                          {analysis.summaryStory}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Key Metrics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-border/60 bg-background/50">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Hops</p>
                      <div className="text-2xl font-bold font-display text-foreground mt-1 flex items-baseline gap-1.5">
                        {analysis.totalHops} <span className="text-xs text-muted-foreground font-normal">nodes</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Egress to endpoint</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-background/50">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">End-to-End Latency</p>
                      <div className="text-2xl font-bold font-display text-emerald-400 mt-1 flex items-baseline gap-1.5">
                        {analysis.finalLatencyMs !== null ? `${analysis.finalLatencyMs}` : '--'} <span className="text-xs text-muted-foreground font-normal">ms</span>
                      </div>
                      <p className="text-[11px] text-emerald-400/90 mt-1 font-medium">
                        {analysis.finalLatencyMs && analysis.finalLatencyMs < 25 ? 'Ultra-Low Ping' : 'Normal Latency'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-background/50">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Edge Protection</p>
                      <div className="text-base font-bold font-display text-primary mt-1 truncate" title={analysis.edgeProtection}>
                        {analysis.edgeProtection}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {analysis.destinationIp ? `IP: ${analysis.destinationIp}` : 'Active Anycast'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border/60 bg-background/50">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Route Integrity</p>
                      <div className="text-2xl font-bold font-display text-foreground mt-1 flex items-baseline gap-1.5">
                        {analysis.routeHealthScore}%
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Clean path & peering
                      </p>
                    </div>
                  </div>

                  {/* 3. Security & Infrastructure Findings */}
                  {analysis.insights.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Infrastructure & Security Insights
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {analysis.insights.map((insight, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                              insight.type === 'safe'
                                ? 'bg-safe/5 border-safe/20 text-safe'
                                : insight.type === 'warning'
                                ? 'bg-warning/5 border-warning/20 text-warning'
                                : 'bg-primary/5 border-primary/20 text-primary'
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold">{insight.title}</p>
                              <p className="text-xs opacity-90 mt-0.5 leading-relaxed text-muted-foreground">
                                {insight.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Tab Views: Smart Route Map vs Raw Terminal */}
                  {activeTab === 'smart' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Hop-by-Hop Route Breakdown ({analysis.hops.length} steps)
                        </h4>
                        <span className="text-[11px] text-muted-foreground">
                          Hover or inspect nodes for carrier transit details
                        </span>
                      </div>

                      <div className="space-y-2">
                        {analysis.hops.map((hop) => (
                          <div
                            key={hop.hop}
                            className="p-3.5 rounded-xl border border-border/50 bg-background/60 hover:bg-muted/40 transition-colors flex items-center justify-between flex-wrap gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <span className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center font-mono text-xs font-bold text-foreground">
                                #{hop.hop}
                              </span>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadgeClass(hop.category)}`}>
                                    {hop.categoryLabel}
                                  </span>
                                  <span className="font-mono text-xs font-semibold text-foreground">
                                    {hop.host}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {hop.organization} &bull; <span className="font-mono">{hop.ip}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <p className="text-[11px] text-muted-foreground hidden sm:block max-w-xs text-right truncate" title={hop.description}>
                                {hop.description}
                              </p>
                              {getLatencyBadge(hop.rtt, hop.isTimeout)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Raw Terminal View */
                    <div className="space-y-2">
                      <div className="p-4 rounded-xl border border-border/50 bg-black/80 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre text-slate-300 shadow-inner">
                        {traceroute}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <span className="flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-primary" />
                          Runs directly in your browser client
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          Logged to DevTools Console (<kbd className="px-1 bg-muted rounded text-[9px]">F12</kbd>)
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {!isTracingRoute && !analysis && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No route data available.
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
