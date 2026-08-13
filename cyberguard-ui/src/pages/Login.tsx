import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, User, Lock, Eye, EyeOff } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';
import { useLogin, useRegister } from '@/hooks/api/useAuth';
import { useAuthStore } from '@/stores/authStore';

const tickerAlerts = [
  'Protected by AI-Powered Threat Detection',
  'Real-Time Phishing Prevention Active',
  'ML Model Scanning URLs Continuously',
];

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
        ctx.fill();

        particles.slice(i + 1).forEach(p2 => {
          const d = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${0.15 * (1 - d / 120)})`;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loginStore = useAuthStore(s => s.login);
  const login = useLogin();
  const register = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = isRegister
        ? await register.mutateAsync({ email, password, displayName })
        : await login.mutateAsync({ email, password });
      if (result.data) {
        loginStore(result.data.user, result.data.accessToken);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    }
  };

  const isLoading = login.isPending || register.isPending;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
        <ParticleCanvas />
        <div className="relative z-10 text-center px-12">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-8 mx-auto w-28 h-28 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-glow-cyan"
          >
            <Shield className="w-14 h-14 text-primary" />
          </motion.div>
          <h1 className="font-display text-5xl font-bold text-foreground mb-4 text-glow-cyan">
            CyberGuard AI
          </h1>
          <p className="text-text-secondary text-lg max-w-md mx-auto">
            Real-Time Threat Detection for the Next Generation
          </p>
        </div>

        {/* Ticker */}
        <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur border-t border-border py-2 overflow-hidden">
          <motion.div
            animate={{ x: ['100%', '-100%'] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="whitespace-nowrap font-mono text-xs text-destructive/80"
          >
            {tickerAlerts.join('     •     ')}
          </motion.div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm"
        >
          <div className="glass-card p-8 space-y-6">
            <div className="text-center">
              <div className="lg:hidden w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {isRegister ? 'Create Account' : 'Sign In'}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {isRegister ? 'Register for CyberGuard Dashboard' : 'Access CyberGuard Dashboard'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              )}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={8}
                  className="w-full h-11 pl-10 pr-10 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <GlowButton type="submit" className="w-full" disabled={isLoading} size="lg">
                {isLoading ? (isRegister ? 'Creating Account...' : 'Signing In...') : (isRegister ? 'Create Account' : 'Sign In to CyberGuard')}
              </GlowButton>
            </form>

            <div className="text-center">
              {!isRegister && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Demo Accounts</p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setEmail('admin@example.com'); setPassword('admin123'); }}
                      className="text-xs px-3 py-1.5 rounded bg-muted/30 hover:bg-muted/50 border border-border text-foreground transition-colors"
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmail('student@example.com'); setPassword('student123'); }}
                      className="text-xs px-3 py-1.5 rounded bg-muted/30 hover:bg-muted/50 border border-border text-foreground transition-colors"
                    >
                      Student
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setIsRegister(v => !v); setError(null); }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
              <p className="text-[10px] text-muted-foreground mt-4">
                Protected by AI • 256-bit Encryption • Real-Time Monitoring
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
