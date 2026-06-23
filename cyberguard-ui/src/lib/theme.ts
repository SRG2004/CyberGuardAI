import type { Threat } from '@/types';

export function getRiskColor(score: number): string {
  if (score >= 80) return 'text-destructive';
  if (score >= 50) return 'text-warning';
  if (score >= 20) return 'text-primary';
  return 'text-safe';
}

export function getRiskBg(score: number): string {
  if (score >= 80) return 'bg-destructive/10 border-destructive/30 text-destructive';
  if (score >= 50) return 'bg-warning/10 border-warning/30 text-warning';
  if (score >= 20) return 'bg-primary/10 border-primary/30 text-primary';
  return 'bg-safe/10 border-safe/30 text-safe';
}

export function getThreatTypeColor(type: Threat['type']): string {
  const lower = type.toLowerCase();
  if (lower === 'phishing') return 'text-destructive';
  if (lower === 'malware') return 'text-warning';
  if (lower === 'suspicious') return 'text-primary';
  return 'text-safe';
}

export function getThreatTypeBg(type: Threat['type']): string {
  const lower = type.toLowerCase();
  if (lower === 'phishing') return 'bg-destructive/10 border-destructive/30 text-destructive';
  if (lower === 'malware') return 'bg-warning/10 border-warning/30 text-warning';
  if (lower === 'suspicious') return 'bg-primary/10 border-primary/30 text-primary';
  return 'bg-safe/10 border-safe/30 text-safe';
}

export function getVerdictColor(verdict: Threat['verdict']): string {
  if (verdict === 'malicious') return 'text-destructive';
  if (verdict === 'suspicious') return 'text-warning';
  return 'text-safe';
}

export function getVerdictBadge(verdict: Threat['verdict']): string {
  if (verdict === 'malicious') return 'bg-destructive/10 text-destructive border border-destructive/30';
  if (verdict === 'suspicious') return 'bg-warning/10 text-warning border border-warning/30';
  return 'bg-safe/10 text-safe border border-safe/30';
}
