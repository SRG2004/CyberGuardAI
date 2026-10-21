export interface HopData {
  hop: number;
  host: string;
  ip: string;
  rtt: number | null;
  isTimeout: boolean;
  category: 'local' | 'transit' | 'cdn' | 'destination' | 'firewall';
  categoryLabel: string;
  organization: string;
  latencyRating: 'fast' | 'normal' | 'slow' | 'timeout';
  description: string;
}

export interface RouteInsight {
  title: string;
  description: string;
  type: 'safe' | 'info' | 'warning';
}

export interface RouteAnalysis {
  targetHost: string;
  destinationIp: string;
  totalHops: number;
  finalLatencyMs: number | null;
  avgLatencyMs: number | null;
  routeHealthScore: number;
  edgeProtection: string;
  transitCarriers: string[];
  summaryStory: string;
  insights: RouteInsight[];
  hops: HopData[];
}

/**
 * Detect organization / network provider from hostname and IP address
 */
function identifyProvider(host: string, ip: string): { org: string; isCdn: boolean; isTransit: boolean } {
  const h = (host || '').toLowerCase();
  const i = (ip || '').toLowerCase();

  // Cloudflare
  if (
    h.includes('cloudflare') ||
    i.startsWith('104.') ||
    i.startsWith('172.67.') ||
    i.startsWith('141.101.') ||
    i.startsWith('162.158.') ||
    i.startsWith('198.41.') ||
    i.startsWith('188.114.')
  ) {
    return { org: 'Cloudflare Anycast CDN & DDoS Guard', isCdn: true, isTransit: false };
  }

  // AWS CloudFront / EC2
  if (h.includes('cloudfront') || h.includes('amazon') || h.includes('aws')) {
    return { org: 'Amazon Web Services (AWS)', isCdn: true, isTransit: false };
  }

  // Google Cloud / Edge
  if (h.includes('google') || h.includes('1e100') || i.startsWith('142.250.') || i.startsWith('172.217.')) {
    return { org: 'Google Cloud Platform (GCP)', isCdn: true, isTransit: false };
  }

  // Akamai
  if (h.includes('akamai') || h.includes('akamaitechnologies')) {
    return { org: 'Akamai Edge Network', isCdn: true, isTransit: false };
  }

  // Fastly
  if (h.includes('fastly')) {
    return { org: 'Fastly Global CDN', isCdn: true, isTransit: false };
  }

  // Microsoft Azure / Edge
  if (h.includes('azure') || h.includes('microsoft')) {
    return { org: 'Microsoft Azure Cloud', isCdn: true, isTransit: false };
  }

  // Cogent Communications
  if (h.includes('cogentco') || h.includes('atlas.cogentco') || i.startsWith('154.54.') || i.startsWith('66.28.') || i.startsWith('38.')) {
    return { org: 'Cogent Communications (Tier-1 Transit)', isCdn: false, isTransit: true };
  }

  // Zayo / Level3 / Lumen / Telia / Tata
  if (h.includes('zayo')) return { org: 'Zayo Group Fiber Backbone', isCdn: false, isTransit: true };
  if (h.includes('level3') || h.includes('lumen') || h.includes('centurylink')) return { org: 'Lumen (Level 3) Tier-1 Backbone', isCdn: false, isTransit: true };
  if (h.includes('telia') || h.includes('arelion')) return { org: 'Arelion (Telia Carrier) Tier-1', isCdn: false, isTransit: true };
  if (h.includes('tatacommunications')) return { org: 'Tata Communications Global Transit', isCdn: false, isTransit: true };
  if (h.includes('airtel') || h.includes('bharti')) return { org: 'Bharti Airtel Global Backbone', isCdn: false, isTransit: true };
  if (h.includes('hetzner')) return { org: 'Hetzner Online Backbone', isCdn: false, isTransit: true };
  if (h.includes('ovh')) return { org: 'OVHcloud Network', isCdn: false, isTransit: true };

  // Private RFC1918 subnets
  if (i.startsWith('10.') || i.startsWith('192.168.') || i.match(/^172\.(1[6-9]|2\d|3[01])\./)) {
    return { org: 'Internal Private Subnet (RFC1918)', isCdn: false, isTransit: false };
  }

  return { org: 'Regional ISP / Peering Exchange', isCdn: false, isTransit: false };
}

/**
 * Parses raw traceroute string and constructs a human-readable intelligence report
 */
export function analyzeTraceroute(rawOutput: string, targetHostFallback: string): RouteAnalysis {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return {
      targetHost: targetHostFallback,
      destinationIp: '',
      totalHops: 0,
      finalLatencyMs: null,
      avgLatencyMs: null,
      routeHealthScore: 0,
      edgeProtection: 'Unknown',
      transitCarriers: [],
      summaryStory: 'No network hops available to inspect.',
      insights: [],
      hops: []
    };
  }

  const lines = rawOutput.split('\n');
  const hops: HopData[] = [];
  let destinationIp = '';
  let targetHost = targetHostFallback;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect header: traceroute to www.domain.com (1.2.3.4), 20 hops max...
    const headerMatch = trimmed.match(/^traceroute to ([^\s]+)\s+\(([^)]+)\)/i);
    if (headerMatch) {
      targetHost = headerMatch[1];
      destinationIp = headerMatch[2];
      continue;
    }

    // Match hop lines: e.g. " 1  _gateway (75.127.11.161)  1.886 ms  0.978 ms"
    const hopMatch = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!hopMatch) continue;

    const hopNum = parseInt(hopMatch[1], 10);
    const rest = hopMatch[2].trim();

    // Check if timed-out hop
    if (rest.startsWith('*')) {
      hops.push({
        hop: hopNum,
        host: 'Hidden Node / Firewall Filtered',
        ip: 'Filtered (No Response)',
        rtt: null,
        isTimeout: true,
        category: 'firewall',
        categoryLabel: 'Silent Router',
        organization: 'Security Gateway / Rate-Limited Boundary',
        latencyRating: 'timeout',
        description: 'Router configured to silence ICMP TTL-expired notifications for protection.'
      });
      continue;
    }

    // Extract hostname and IP
    const hostIpMatch = rest.match(/^([^\s(]+)(?:\s+\(([^)]+)\))?/);
    let host = hostIpMatch ? hostIpMatch[1] : 'Unknown';
    let ip = hostIpMatch && hostIpMatch[2] ? hostIpMatch[2] : (host.match(/\d+\.\d+\.\d+\.\d+/) ? host : '');

    // Extract latency ms
    const rtts: number[] = [];
    const rttMatches = rest.matchAll(/([0-9.]+)\s+ms/gi);
    for (const m of rttMatches) {
      const val = parseFloat(m[1]);
      if (!isNaN(val)) rtts.push(val);
    }
    const avgRtt = rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;

    const { org, isCdn, isTransit } = identifyProvider(host, ip);

    let category: HopData['category'] = 'transit';
    let categoryLabel = 'Transit Backbone';
    let description = 'Carrying packets across internet transit corridors.';

    const isPrivate = ip.startsWith('10.') || ip.startsWith('192.168.') || Boolean(ip.match(/^172\.(1[6-9]|2\d|3[01])\./));

    if (hopNum === 1 || host.toLowerCase().includes('gateway') || isPrivate) {
      category = 'local';
      categoryLabel = 'Local Gateway';
      description = 'Initial egress route passing through local network switch / cloud VPC edge.';
    } else if (isCdn) {
      category = 'cdn';
      categoryLabel = 'Protected CDN Edge';
      description = 'High-speed Anycast node with active DDoS shield & SSL inspection.';
    } else if (isTransit) {
      category = 'transit';
      categoryLabel = 'Tier-1 Backbone';
      description = `Long-haul carrier fiber interconnect operated by ${org.split(' ')[0]}.`;
    }

    let latencyRating: HopData['latencyRating'] = 'fast';
    if (avgRtt !== null) {
      if (avgRtt < 25) latencyRating = 'fast';
      else if (avgRtt < 85) latencyRating = 'normal';
      else latencyRating = 'slow';
    }

    hops.push({
      hop: hopNum,
      host,
      ip: ip || host,
      rtt: avgRtt ? Math.round(avgRtt * 100) / 100 : null,
      isTimeout: false,
      category,
      categoryLabel,
      organization: org,
      latencyRating,
      description
    });
  }

  // Mark the final hop as destination
  if (hops.length > 0) {
    const last = hops[hops.length - 1];
    if (!last.isTimeout) {
      last.category = 'destination';
      last.categoryLabel = 'Destination Server';
      last.description = `Final web application endpoint resolved for ${targetHost}.`;
      if (!destinationIp && last.ip) {
        destinationIp = last.ip;
      }
    }
  }

  // Derive global metrics
  const validRtts = hops.filter((h) => h.rtt !== null).map((h) => h.rtt as number);
  const finalHop = hops[hops.length - 1];
  const finalLatencyMs = finalHop && finalHop.rtt !== null ? finalHop.rtt : (validRtts.length > 0 ? validRtts[validRtts.length - 1] : null);
  const avgLatencyMs = validRtts.length > 0 ? Math.round((validRtts.reduce((a, b) => a + b, 0) / validRtts.length) * 10) / 10 : null;

  // Identify CDN and transit carriers
  const foundCarriers = Array.from(
    new Set(
      hops
        .filter((h) => h.category === 'transit' && h.organization && !h.organization.includes('Private'))
        .map((h) => h.organization.split(' (')[0])
    )
  );

  const cdnHop = hops.find((h) => h.category === 'cdn' || h.organization.includes('Cloudflare') || h.organization.includes('AWS') || h.organization.includes('Google') || h.organization.includes('Akamai'));
  const edgeProtection = cdnHop ? cdnHop.organization.split(' ')[0] + ' Anycast Proxy' : 'Direct Origin Host';

  // Calculate Route Health Score (0 - 100)
  let healthScore = 100;
  const timeoutCount = hops.filter((h) => h.isTimeout).length;
  if (timeoutCount > 3) healthScore -= 10;
  if (finalLatencyMs && finalLatencyMs > 150) healthScore -= 15;
  else if (finalLatencyMs && finalLatencyMs > 75) healthScore -= 5;
  healthScore = Math.max(70, Math.min(100, healthScore));

  // Synthesize Plain-English Route Story
  const carrierName = foundCarriers.length > 0 ? foundCarriers.join(' & ') : 'Standard Tier-1 Transit';
  const cdnName = cdnHop ? cdnHop.organization.split(' ')[0] : null;

  let summaryStory = `Traffic originated from your client browser, routed through ${hops.filter((h) => h.category === 'local').length || 1} local gateway hops, entered the ${carrierName} high-speed backbone`;
  if (cdnName) {
    summaryStory += `, and terminated at a ${cdnName} edge node with active DDoS proxy shielding.`;
  } else {
    summaryStory += `, arriving directly at the destination host (${targetHost}).`;
  }

  // Generate Key Insights
  const insights: RouteInsight[] = [];

  if (cdnName) {
    insights.push({
      title: `${cdnName} Security Shield Active`,
      description: `The destination IP (${destinationIp || 'Anycast'}) is an edge proxy. The true web server origin is cloaked behind DDoS mitigation and Web Application Firewalls (WAF).`,
      type: 'safe'
    });
  }

  if (finalLatencyMs !== null) {
    if (finalLatencyMs < 30) {
      insights.push({
        title: 'Ultra-Low Latency Peering',
        description: `Round-trip response time is only ${finalLatencyMs} ms. The destination has direct regional routing peering with zero bottleneck delays.`,
        type: 'safe'
      });
    } else if (finalLatencyMs > 150) {
      insights.push({
        title: 'Elevated Latency Detected',
        description: `Round-trip response time is ${finalLatencyMs} ms, suggesting international transit routing or cross-continental hops.`,
        type: 'info'
      });
    }
  }

  if (timeoutCount > 0) {
    insights.push({
      title: `${timeoutCount} Silent / Rate-Limited Node(s)`,
      description: `Hops showing "* *" are routers configured to suppress ICMP TTL-exceeded replies for security. Packets passed through without dropping.`,
      type: 'info'
    });
  }

  if (foundCarriers.length > 0) {
    insights.push({
      title: 'Tier-1 Backbone Transit',
      description: `Interconnect carried via enterprise carrier (${foundCarriers.join(', ')}), ensuring high throughput and route stability.`,
      type: 'safe'
    });
  }

  return {
    targetHost,
    destinationIp,
    totalHops: hops.length,
    finalLatencyMs,
    avgLatencyMs,
    routeHealthScore: healthScore,
    edgeProtection,
    transitCarriers: foundCarriers,
    summaryStory,
    insights,
    hops
  };
}
