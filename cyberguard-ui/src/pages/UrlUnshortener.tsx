import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, Search, ArrowRight, CheckCircle2, ShieldAlert, Loader2, Link as LinkIcon, CornerDownRight } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';
import axios from 'axios';

type UnshortenResult = {
  originalUrl: string;
  finalUrl: string;
  hops: string[];
  redirectCount: number;
};

export default function UrlUnshortener() {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<UnshortenResult | null>(null);

  const handleAnalyze = async () => {
    if (!url) return;
    
    // Add protocol if missing
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      // In a real app, this would use a properly configured Axios instance from hooks
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tools/unshorten`, { url: targetUrl }, { withCredentials: true });
      if (res.data.success) {
        setResult(res.data.data);
      } else {
        toast.error('Analysis failed', { description: res.data.error?.message || 'Failed to resolve URL.' });
      }
    } catch (err: any) {
      toast.error('Analysis failed', { description: err.response?.data?.error?.message || 'Network error occurred.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <Link2 className="w-8 h-8 text-primary" /> URL Unshortener & Tracer
        </h1>
        <p className="text-muted-foreground mt-2">
          Safely reveal the final destination of shortened or obfuscated links (like bit.ly, t.co) without clicking them. See the full redirect chain before visiting.
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
        </motion.div>

        {/* Right - Results */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-3">
          <div className="glass-card p-6 h-full min-h-[400px]">
            <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" /> Redirect Chain
            </h3>

            {!result && !isAnalyzing && (
              <div className="flex flex-col items-center justify-center text-center h-[250px] opacity-50">
                <LinkIcon className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Enter a URL to see its redirect path.</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center text-center h-[250px]">
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
                        {/* Vertical line connecting nodes */}
                        {index !== result.hops.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border/50" />
                        )}
                        
                        {/* Node icon */}
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
    </div>
  );
}
