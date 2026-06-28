export function getTokenMaxAgeSeconds(token: string): number {
  const payload = token.split('.')[1];
  if (!payload) {
    return 0;
  }

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      exp?: number;
    };

    if (!json.exp) {
      return 0;
    }

    return Math.max(0, json.exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
}
