import { NextRequest, NextResponse } from 'next/server';

import { setAuthCookies } from '@/lib/api/auth-cookies';
import { ApiError } from '@/lib/api/errors';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const error = await ApiError.fromResponse(res);
    return NextResponse.json(
      { statusCode: error.statusCode, code: error.code, message: error.message },
      { status: res.status },
    );
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    user: unknown;
  };

  await setAuthCookies(data.accessToken, data.refreshToken);

  return NextResponse.json({ user: data.user });
}
