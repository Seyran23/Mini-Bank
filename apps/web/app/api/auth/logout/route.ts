import { NextResponse } from 'next/server';

import { clearAuthCookies, getRefreshToken } from '@/lib/api/auth-cookies';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    await fetch(`${GATEWAY_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  await clearAuthCookies();

  return new NextResponse(null, { status: 204 });
}
