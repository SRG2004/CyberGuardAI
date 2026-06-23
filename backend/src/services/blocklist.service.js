import Blocklist from '../models/Blocklist.js';

export async function getActiveBlocklist() {
  return Blocklist.find({ isActive: true }, { domain: 1, threatType: 1 }).lean();
}

export async function checkDomain(domain) {
  if (!domain) return false;
  const host = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
  const entry = await Blocklist.findOne({ domain: host, isActive: true });
  return !!entry;
}

export async function addDomain(domain, addedBy, reason, threatType, source = 'admin') {
  const existing = await Blocklist.findOne({ domain });
  if (existing) return existing;
  return Blocklist.create({ domain, addedBy, reason, threatType, source });
}

export async function removeDomain(domain) {
  return Blocklist.findOneAndUpdate({ domain }, { isActive: false });
}

export async function importDomains(domains, addedBy, reason, source = 'import') {
  const ops = domains.map(d => ({
    updateOne: {
      filter: { domain: d.domain },
      update: {
        domain: d.domain,
        addedBy,
        reason: d.reason || reason,
        threatType: d.threatType || 'phishing',
        source,
        isActive: true,
      },
      upsert: true,
    },
  }));
  if (ops.length > 0) return Blocklist.bulkWrite(ops);
  return null;
}
