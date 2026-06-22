import { ExecutionContext } from '@nestjs/common';

import { UnauthorizedException } from '@minibank/errors';

import { InternalAuthGuard } from './internal-auth.guard';

const INTERNAL_API_KEY = 'a-valid-test-internal-api-key';

function contextWithHeader(value: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-internal-api-key': value } }),
    }),
  } as unknown as ExecutionContext;
}

describe('InternalAuthGuard', () => {
  const guard = new InternalAuthGuard({
    ACCOUNTS_INTERNAL_API_KEY: INTERNAL_API_KEY,
  } as never);

  it('allows the request when the header matches the configured key', () => {
    expect(guard.canActivate(contextWithHeader(INTERNAL_API_KEY))).toBe(true);
  });

  it('rejects when the header is missing', () => {
    expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow(UnauthorizedException);
  });

  it('rejects when the header is sent multiple times (array value)', () => {
    expect(() =>
      guard.canActivate(contextWithHeader([INTERNAL_API_KEY, INTERNAL_API_KEY])),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a key of a different length', () => {
    expect(() => guard.canActivate(contextWithHeader('too-short'))).toThrow(UnauthorizedException);
  });

  it('rejects a same-length but incorrect key', () => {
    const wrongKey = 'b'.repeat(INTERNAL_API_KEY.length);
    expect(() => guard.canActivate(contextWithHeader(wrongKey))).toThrow(UnauthorizedException);
  });
});
