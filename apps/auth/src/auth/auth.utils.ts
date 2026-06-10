import crypto from 'node:crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseExpiryToDate(expiresIn: string): Date {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
  if (!match?.[1] || !match?.[2]) {
    throw new Error(`Invalid expiresIn format: "${expiresIn}"`);
  }
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(Date.now() + parseInt(match[1]) * (multipliers[match[2]] ?? 0));
}
