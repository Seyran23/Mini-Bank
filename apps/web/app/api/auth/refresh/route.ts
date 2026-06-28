import { NextResponse } from 'next/server';

import { getRefreshToken, setAuthCookies } from '@/lib/api/auth-cookies';
import { ApiError } from '@/lib/api/errors';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return NextResponse.json(
      { statusCode: 401, code: 'UNAUTHORIZED', message: 'Not logged in' },
      { status: 401 },
    );
  }

  const res = await fetch(`${GATEWAY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await ApiError.fromResponse(res);
    return NextResponse.json(
      { statusCode: error.statusCode, code: error.code, message: error.message },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  await setAuthCookies(data.accessToken, data.refreshToken);

  return new NextResponse(null, { status: 204 });
}
