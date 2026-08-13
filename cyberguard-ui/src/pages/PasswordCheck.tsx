import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';

export default function PasswordCheck() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ leaked: boolean; count: number; error?: string } | null>(null);

  const hashPassword = async (pwd: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  const checkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setResult(null);

    try {
      const hash = await hashPassword(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) throw new Error('API Error');
      
      const text = await res.text();
      const lines = text.split('\n');
      
      let leakCount = 0;
      for (const line of lines) {
        const [lineSuffix, count] = line.split(':');
        if (lineSuffix.trim() === suffix) {
          leakCount = parseInt(count.trim(), 10);
          break;
        }
      }

      setResult({ leaked: leakCount > 0, count: leakCount });
    } catch (error) {
      setResult({ leaked: false, count: 0, error: 'Failed to check password securely.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">Password Breach Scanner</h1>
        <p className="text-muted-foreground mt-2">
          Securely check if your passwords have been exposed in known data breaches. 
          We use zero-knowledge **k-Anonymity**—your password is hashed locally and never leaves your browser.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="glass-card p-8">
          <form onSubmit={checkPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Password to Check</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a password..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                  disabled={loading}
                />
              </div>
            </div>
            
            <GlowButton type="submit" disabled={!password || loading} className="w-full h-12">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Scanning Data Breaches...</>
              ) : (
                'Secure Scan'
              )}
            </GlowButton>
          </form>

          {result && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className={`mt-6 p-6 rounded-xl border ${result.error ? 'bg-destructive/10 border-destructive/30' : result.leaked ? 'bg-destructive/10 border-destructive/30' : 'bg-safe/10 border-safe/30'} flex items-start gap-4`}
            >
              <div className="mt-1">
                {result.error ? (
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                ) : result.leaked ? (
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-safe" />
                )}
              </div>
              <div>
                <h3 className={`font-semibold text-lg ${result.error ? 'text-destructive' : result.leaked ? 'text-destructive' : 'text-safe'}`}>
                  {result.error ? 'Error' : result.leaked ? 'Password Compromised!' : 'Password is Safe'}
                </h3>
                <p className="text-sm text-foreground mt-1">
                  {result.error ? result.error : result.leaked 
                    ? `This password has been seen ${result.count.toLocaleString()} times in known data breaches. You should never use this password.` 
                    : 'Good news! This password was not found in any known data breaches.'}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
