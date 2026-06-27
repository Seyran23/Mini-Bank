import { ServiceUnavailableException } from '@minibank/errors';

import type { GatewayConfig } from '@/config/gateway.config';

import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  const config = { ACCOUNTS_SERVICE_URL: 'http://localhost:3002' } as GatewayConfig;
  let service: AccountsService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new AccountsService(config);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('forwards createAccount with the bearer token and body', async () => {
    fetchMock.mockResolvedValue({
      status: 201,
      json: () => Promise.resolve({ id: 'acc-1' }),
    });

    const result = await service.createAccount({ currency: 'USD' }, 'token-1', 'corr-1');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3002/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-1',
        'x-correlation-id': 'corr-1',
      },
      body: JSON.stringify({ currency: 'USD' }),
    });
    expect(result).toEqual({ status: 201, body: { id: 'acc-1' } });
  });

  it('forwards getAccount without a request body', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: () => Promise.resolve({ id: 'acc-1' }) });

    await service.getAccount('acc-1', 'token-1', 'corr-2');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('forwards deposit to the correct nested path', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: () => Promise.resolve({}) });

    await service.deposit('acc-1', { amount: '10.00' }, 'token-1', 'corr-3');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3002/accounts/acc-1/deposit',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws ServiceUnavailableException when the network call fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.listAccounts('token-1', 'corr-4')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
