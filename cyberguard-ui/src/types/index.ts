export interface User {
  _id: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  isActive: boolean;
  createdAt: string;
  lastActive: string;
  points?: number;
  level?: number;
  badges?: Array<{ id: string; name: string; earnedAt: string; icon: string }>;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Threat {
  _id: string;
  url?: string;
  emailSubject?: string;
  type: string;
  riskScore: number;
  verdict: 'safe' | 'suspicious' | 'malicious';
  isVerified: boolean;
  sources?: Record<string, unknown>;
  createdAt: string;
}

export interface ScanHistoryItem {
  _id: string;
  userId: string;
  input: string;
  inputType: 'url' | 'email';
  result: { _id: string; riskScore: number; verdict: string; type: string; createdAt?: string };
  source: string;
  durationMs: number;
  createdAt: string;
}

export interface Report {
  _id: string;
  submittedBy?: { _id: string; displayName: string; email: string };
  type: string;
  url?: string;
  description?: string;
  status: 'pending' | 'under_review' | 'confirmed' | 'dismissed';
  aiScore?: number;
  aiVerdict?: string;
  createdAt: string;
}

export interface DashboardSummary {
  threatsToday: number;
  scansToday: number;
  emailsToday: number;
  totalThreats: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface TopDomain {
  domain: string;
  riskScore: number;
  count: number;
  lastSeen: string;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface TimelinePoint {
  hour: string;
  threats: number;
  scans: number;
}

export interface RadarPoint {
  category: string;
  value: number;
  fullMark: number;
}

export interface BlocklistEntry {
  _id: string;
  domain: string;
  reason: string;
  threatType: string;
  source: string;
  isActive: boolean;
  createdAt: string;
}

export interface TodayStats {
  phishing: number;
  malware: number;
  suspicious: number;
  safe: number;
  totalScans: number;
}

export interface ScanResponse {
  scanId: string;
  input: string;
  verdict: string;
  riskScore: number;
  sources: {
    mlModel: { probability: number; features: string[] };
    whois: { domainAge: number | null; registrar: string | null; country: string };
  };
  threatId: string;
  durationMs: number;
  emailSignals?: Array<{ type: string; text: string; severity: string }>;
  emailHighlights?: Array<{ start: number; end: number; reason: string; color: string }>;
}
