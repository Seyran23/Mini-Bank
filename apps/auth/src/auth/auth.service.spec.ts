import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { ConflictException, UnauthorizedException } from '@minibank/errors';

import { AuthRepository, RefreshTokenWithUser } from '@/auth/auth.repository';
import { AuthService } from '@/auth/auth.service';
import { AUTH_CONFIG } from '@/config/auth.config';

// ts-jest hoists jest.mock() calls, so these run before any module code
jest.mock('argon2');
jest.mock('uuid');

const hashMock = argon2.hash as jest.Mock;
const verifyMock = argon2.verify as jest.Mock;
const uuidMock = uuidv4 as jest.Mock;

const mockUser: User = {
  id: 'user-id-1',
  email: 'jane@example.com',
  passwordHash: '$argon2id$...',
  firstName: 'Jane',
  lastName: 'Doe',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const testConfig = {
  NODE_ENV: 'test' as const,
  AUTH_PORT: '3001',
  AUTH_DATABASE_URL: 'postgresql://test',
  AUTH_JWT_ACCESS_PRIVATE_KEY_BASE64: Buffer.from('test-access-private').toString('base64'),
  AUTH_JWT_ACCESS_PUBLIC_KEY_BASE64: Buffer.from('test-access-public').toString('base64'),
  AUTH_JWT_REFRESH_PRIVATE_KEY_BASE64: Buffer.from('test-refresh-private').toString('base64'),
  AUTH_JWT_REFRESH_PUBLIC_KEY_BASE64: Buffer.from('test-refresh-public').toString('base64'),
  AUTH_JWT_ACCESS_EXPIRES_IN: '15m',
  AUTH_JWT_REFRESH_EXPIRES_IN: '7d',
  LOG_LEVEL: 'info' as const,
};

describe('AuthService', () => {
  let service: AuthService;
  let repo: jest.Mocked<AuthRepository>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findUserByEmail: jest.fn(),
            createUser: jest.fn(),
            createRefreshToken: jest.fn(),
            findRefreshTokenByHash: jest.fn(),
            revokeRefreshToken: jest.fn(),
            revokeTokenFamily: jest.fn(),
            countActiveSessions: jest.fn(),
            revokeOldestSession: jest.fn(),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: AUTH_CONFIG, useValue: testConfig },
      ],
    }).compile();

    service = module.get(AuthService);
    repo = module.get(AuthRepository);
    jwt = module.get(JwtService);

    (jwt.sign as jest.Mock).mockImplementation((payload: Record<string, unknown>) =>
      payload['type'] === 'access' ? 'mock-access-token' : 'mock-refresh-token',
    );
    repo.createRefreshToken.mockResolvedValue({} as never);
    uuidMock.mockReturnValue('test-uuid');
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      repo.findUserByEmail.mockResolvedValue(null);
      hashMock.mockResolvedValue('hashed-pw');
      repo.createUser.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'Jane@Example.com',
        password: 'secret123',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(repo.findUserByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com', passwordHash: 'hashed-pw' }),
      );
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    it('throws ConflictException when email is already registered', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'jane@example.com',
          password: 'pw',
          firstName: 'J',
          lastName: 'D',
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser);
      verifyMock.mockResolvedValue(true);
      repo.countActiveSessions.mockResolvedValue(0);

      const result = await service.login({ email: 'jane@example.com', password: 'secret123' });

      expect(result.accessToken).toBe('mock-access-token');
      expect(repo.revokeOldestSession).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      repo.findUserByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@example.com', password: 'pw' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser);
      verifyMock.mockResolvedValue(false);

      await expect(service.login({ email: 'jane@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the oldest session when the 5-session cap is reached', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser);
      verifyMock.mockResolvedValue(true);
      repo.countActiveSessions.mockResolvedValue(5);
      repo.revokeOldestSession.mockResolvedValue(undefined as never);

      await service.login({ email: 'jane@example.com', password: 'secret123' });

      expect(repo.revokeOldestSession).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('refresh', () => {
    const activeToken: RefreshTokenWithUser = {
      id: 'token-id',
      userId: 'user-id-1',
      familyId: 'family-id',
      tokenHash: 'some-hash',
      deviceId: 'device-id',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      user: mockUser,
    };

    it('rotates tokens for a valid refresh token', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue(activeToken);
      repo.revokeRefreshToken.mockResolvedValue({} as never);

      const result = await service.refresh({ refreshToken: 'valid-token' });

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('token-id');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.deviceId).toBe('device-id');
    });

    it('throws UnauthorizedException when token is not found', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'unknown' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the entire family and throws on reuse detection', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue({ ...activeToken, isRevoked: true });
      repo.revokeTokenFamily.mockResolvedValue({ count: 1 });

      await expect(service.refresh({ refreshToken: 'reused-token' })).rejects.toThrow(
        UnauthorizedException,
      );

      expect(repo.revokeTokenFamily).toHaveBeenCalledWith('family-id');
      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException and revokes the token when it is expired', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue({
        ...activeToken,
        expiresAt: new Date(Date.now() - 1000),
      });
      repo.revokeRefreshToken.mockResolvedValue({} as never);

      await expect(service.refresh({ refreshToken: 'expired-token' })).rejects.toThrow(
        UnauthorizedException,
      );

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('token-id');
    });
  });

  describe('logout', () => {
    const activeToken: RefreshTokenWithUser = {
      id: 'token-id',
      userId: 'user-id-1',
      familyId: 'family-id',
      tokenHash: 'some-hash',
      deviceId: 'device-id',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(),
      user: mockUser,
    };

    it('revokes an active token', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue(activeToken);
      repo.revokeRefreshToken.mockResolvedValue({} as never);

      await service.logout({ refreshToken: 'active-token' });

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('token-id');
    });

    it('does nothing when the token is not found (idempotent)', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(service.logout({ refreshToken: 'unknown' })).resolves.toBeUndefined();
      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('does nothing when the token is already revoked (idempotent)', async () => {
      repo.findRefreshTokenByHash.mockResolvedValue({ ...activeToken, isRevoked: true });

      await expect(service.logout({ refreshToken: 'already-revoked' })).resolves.toBeUndefined();
      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });
});
