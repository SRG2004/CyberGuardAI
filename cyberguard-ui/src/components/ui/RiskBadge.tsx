import { type ThreatType, getThreatBg } from '@/lib/threat-colors';

export function RiskBadge({ type }: { type: ThreatType }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getThreatBg(type)}`}>
      {type}
    </span>
  );
}
