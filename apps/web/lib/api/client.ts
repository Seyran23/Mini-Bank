import 'server-only';

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from './auth-cookies';
import { ApiError } from './errors';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

interface ApiFetchOptions extends RequestInit {
  parseAs?: 'json' | 'text';
}

export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const { parseAs = 'json', ...requestInit } = init;
  const accessToken = await getAccessToken();

  let res = await gatewayRequest(path, requestInit, accessToken);

  if (res.status === 401) {
    const refreshedToken = await tryRefresh();
    if (refreshedToken) {
      res = await gatewayRequest(path, requestInit, refreshedToken);
    } else {
      await clearAuthCookies();
    }
  }

  return parseResponse<T>(res, parseAs);
}

function gatewayRequest(
  path: string,
  init: RequestInit,
  accessToken: string | undefined,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${GATEWAY_URL}${path}`, { ...init, headers, cache: 'no-store' });
}

async function tryRefresh(): Promise<string | undefined> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return undefined;
  }

  const res = await fetch(`${GATEWAY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return undefined;
  }

  const body = (await res.json()) as { accessToken: string; refreshToken: string };
  await setAuthCookies(body.accessToken, body.refreshToken);
  return body.accessToken;
}

async function parseResponse<T>(res: Response, parseAs: 'json' | 'text'): Promise<T> {
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (parseAs === 'text' ? await res.text() : await res.json()) as T;
}
