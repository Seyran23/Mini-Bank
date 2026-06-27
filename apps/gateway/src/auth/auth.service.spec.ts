import { ServiceUnavailableException } from '@minibank/errors';

import type { GatewayConfig } from '@/config/gateway.config';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const config = { AUTH_SERVICE_URL: 'http://localhost:3001' } as GatewayConfig;
  let service: AuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new AuthService(config);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('forwards register to Auth and returns the downstream status and body', async () => {
    fetchMock.mockResolvedValue({
      status: 201,
      json: () => Promise.resolve({ accessToken: 'token' }),
    });

    const result = await service.register({ email: 'a@test.com' }, 'corr-1');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': 'corr-1' },
      body: JSON.stringify({ email: 'a@test.com' }),
    });
    expect(result).toEqual({ status: 201, body: { accessToken: 'token' } });
  });

  it('forwards login to the correct path', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: () => Promise.resolve({}) });

    await service.login({ email: 'a@test.com', password: 'x' }, 'corr-2');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes through a downstream error status and body unchanged', async () => {
    fetchMock.mockResolvedValue({
      status: 401,
      json: () => Promise.resolve({ code: 'UNAUTHORIZED', message: 'Invalid email or password' }),
    });

    const result = await service.login({ email: 'a@test.com', password: 'wrong' }, 'corr-3');

    expect(result).toEqual({
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
    });
  });

  it('throws ServiceUnavailableException when the network call itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.logout({ refreshToken: 'x' }, 'corr-4')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
