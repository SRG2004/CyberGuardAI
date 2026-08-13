import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code, ShieldCheck, ShieldAlert, Shield, AlertTriangle, Fingerprint } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';

type AuthResult = {
  protocol: string;
  status: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown';
  domain?: string;
  details?: string;
};

export default function HeaderAnalyzer() {
  const [headers, setHeaders] = useState('');
  const [results, setResults] = useState<AuthResult[] | null>(null);
  const [sender, setSender] = useState<string | null>(null);

  const analyzeHeaders = () => {
    if (!headers) return;

    const authResults: AuthResult[] = [];
    
    // Extract Sender (From line)
    const fromMatch = headers.match(/^From:\s*(.+)$/im);
    if (fromMatch) {
      setSender(fromMatch[1].trim());
    } else {
      setSender('Unknown Sender');
    }

    // Look for Authentication-Results header
    const authHeaderRegex = /^Authentication-Results:\s*([\s\S]*?)(?=^[A-Z][a-z0-9-]+:|\z)/im;
    const authMatch = headers.match(authHeaderRegex);

    if (authMatch) {
      const authContent = authMatch[1].toLowerCase();

      // Extract SPF
      const spfMatch = authContent.match(/spf=(pass|fail|softfail|neutral|none)/);
      if (spfMatch) {
        authResults.push({ protocol: 'SPF', status: spfMatch[1] as any, details: 'Sender Policy Framework' });
      } else {
        authResults.push({ protocol: 'SPF', status: 'unknown', details: 'No SPF record found in headers' });
      }

      // Extract DKIM
      const dkimMatch = authContent.match(/dkim=(pass|fail|neutral|none)/);
      if (dkimMatch) {
        authResults.push({ protocol: 'DKIM', status: dkimMatch[1] as any, details: 'DomainKeys Identified Mail' });
      } else {
        authResults.push({ protocol: 'DKIM', status: 'unknown', details: 'No DKIM signature found' });
      }

      // Extract DMARC
      const dmarcMatch = authContent.match(/dmarc=(pass|fail|bestguesspass|none)/);
      if (dmarcMatch) {
        let status = dmarcMatch[1];
        if (status === 'bestguesspass') status = 'pass';
        authResults.push({ protocol: 'DMARC', status: status as any, details: 'Domain-based Message Authentication' });
      } else {
        authResults.push({ protocol: 'DMARC', status: 'unknown', details: 'No DMARC policy found' });
      }
    } else {
      // No Authentication-Results found at all
      authResults.push({ protocol: 'SPF', status: 'unknown', details: 'Header missing' });
      authResults.push({ protocol: 'DKIM', status: 'unknown', details: 'Header missing' });
      authResults.push({ protocol: 'DMARC', status: 'unknown', details: 'Header missing' });
    }

    setResults(authResults);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-safe bg-safe/10 border-safe/30';
      case 'fail': return 'text-destructive bg-destructive/10 border-destructive/30';
      case 'softfail': 
      case 'neutral': return 'text-warning bg-warning/10 border-warning/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <ShieldCheck className="w-5 h-5 text-safe" />;
      case 'fail': return <ShieldAlert className="w-5 h-5 text-destructive" />;
      case 'softfail': 
      case 'neutral': return <AlertTriangle className="w-5 h-5 text-warning" />;
      default: return <Shield className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <Fingerprint className="w-8 h-8 text-primary" /> Email Header Spoof Analyzer
        </h1>
        <p className="text-muted-foreground mt-2">
          Paste raw email headers to detect spoofing. This tool locally parses SPF, DKIM, and DMARC authentication results to verify the true sender of an email.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="h-full">
          <div className="glass-card p-6 h-full flex flex-col">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" /> Raw Headers
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Paste the full email headers here (usually found under "Show original" or "View source" in your email client).
            </p>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              className="w-full flex-1 min-h-[300px] p-4 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors"
            />
            <GlowButton className="w-full mt-4" onClick={analyzeHeaders} disabled={!headers}>
              Analyze Authentication
            </GlowButton>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
          <div className="glass-card p-6 h-full min-h-[400px]">
            <h3 className="font-semibold text-lg mb-6">Spoof Analysis</h3>
            
            {!results ? (
              <div className="flex flex-col items-center justify-center text-center h-[300px] opacity-50">
                <Shield className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Awaiting header input for analysis.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Claimed Sender</p>
                  <p className="text-sm font-medium text-foreground truncate">{sender}</p>
                </div>

                <div className="space-y-4">
                  {results.map((res, i) => (
                    <div key={i} className={`p-4 rounded-xl border flex items-center justify-between ${getStatusColor(res.status)}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(res.status)}
                          <span className="font-bold text-sm tracking-wide">{res.protocol}</span>
                        </div>
                        <p className="text-xs opacity-90">{res.details}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-background/50 border border-current">
                          {res.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-primary">What this means:</strong><br />
                    - <strong>SPF:</strong> Verifies the sender IP is authorized by the domain.<br />
                    - <strong>DKIM:</strong> Verifies the email content was not tampered with.<br />
                    - <strong>DMARC:</strong> Ensures both SPF and DKIM align with the "From" domain.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
