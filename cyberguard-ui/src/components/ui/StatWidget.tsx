import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

interface StatWidgetProps {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'red' | 'amber';
  delay?: number;
}

const colorMap = {
  cyan: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', glow: 'shadow-glow-cyan' },
  green: { text: 'text-safe', bg: 'bg-safe/10', border: 'border-safe/20', glow: 'shadow-glow-green' },
  red: { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', glow: 'shadow-glow-red' },
  amber: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', glow: 'shadow-glow-amber' },
};

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export function StatWidget({ title, value, subtitle, icon: Icon, color, delay = 0 }: StatWidgetProps) {
  const c = colorMap[color];
  const displayValue = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`glass-card p-5 hover:${c.glow} transition-shadow duration-300 group cursor-default`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
      <div className={`stat-number text-3xl ${c.text} mb-1`}>
        {displayValue.toLocaleString()}
      </div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </motion.div>
  );
}
