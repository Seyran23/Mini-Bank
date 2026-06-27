import { ServiceUnavailableException } from '@minibank/errors';

import type { GatewayConfig } from '@/config/gateway.config';

import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  const config = { TRANSFERS_SERVICE_URL: 'http://localhost:3003' } as GatewayConfig;
  let service: TransfersService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new TransfersService(config);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('forwards createTransfer with the idempotency key header when provided', async () => {
    fetchMock.mockResolvedValue({ status: 202, json: () => Promise.resolve({ id: 'tr-1' }) });

    const dto = { fromAccountId: 'a', toAccountId: 'b', amount: '10.00', currency: 'USD' };
    const result = await service.createTransfer(dto, 'token-1', 'corr-1', 'idem-key-1');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3003/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-1',
        'x-correlation-id': 'corr-1',
        'idempotency-key': 'idem-key-1',
      },
      body: JSON.stringify(dto),
    });
    expect(result).toEqual({ status: 202, body: { id: 'tr-1' } });
  });

  it('omits the idempotency-key header when none is provided', async () => {
    fetchMock.mockResolvedValue({ status: 202, json: () => Promise.resolve({}) });

    await service.createTransfer({}, 'token-1', 'corr-2', undefined);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['idempotency-key']).toBeUndefined();
  });

  it('forwards getTransfer to the correct nested path', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: () => Promise.resolve({ id: 'tr-1' }) });

    await service.getTransfer('tr-1', 'token-1', 'corr-3');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/transfers/tr-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ServiceUnavailableException when the network call fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.listTransfers('token-1', 'corr-4')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
