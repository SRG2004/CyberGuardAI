import crypto from 'crypto';

export function generateAnonId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = (len) => {
    const bytes = crypto.randomBytes(len);
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  };
  return `CG-${group(4)}-${group(4)}`;
}
