'use server';

import { redirect } from 'next/navigation';

import { clearAuthCookies, getRefreshToken } from '@/lib/api/auth-cookies';
import { GATEWAY_URL } from '@/lib/config';

export async function logoutAction(): Promise<void> {
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
  redirect('/login');
}
