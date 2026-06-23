export type ThreatType = 'PHISHING' | 'MALWARE' | 'SUSPICIOUS' | 'SAFE';

export const getThreatColor = (type: ThreatType) => {
  switch (type) {
    case 'PHISHING': return 'text-destructive';
    case 'MALWARE': return 'text-warning';
    case 'SUSPICIOUS': return 'text-primary';
    case 'SAFE': return 'text-safe';
  }
};

export const getThreatBg = (type: ThreatType) => {
  switch (type) {
    case 'PHISHING': return 'bg-destructive/10 border-destructive/30 text-destructive';
    case 'MALWARE': return 'bg-warning/10 border-warning/30 text-warning';
    case 'SUSPICIOUS': return 'bg-primary/10 border-primary/30 text-primary';
    case 'SAFE': return 'bg-safe/10 border-safe/30 text-safe';
  }
};

export const getRiskColor = (score: number) => {
  if (score >= 80) return 'text-destructive';
  if (score >= 50) return 'text-warning';
  if (score >= 20) return 'text-primary';
  return 'text-safe';
};
