import { execSync } from 'node:child_process';
import path from 'node:path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { AuthRepository } from '@/auth/auth.repository';
import { PrismaService } from '@/prisma/prisma.service';

const SERVICE_ROOT = path.resolve(__dirname, '../..');

describe('AuthRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let repo: AuthRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    process.env.AUTH_DATABASE_URL = container.getConnectionUri();

    execSync('npx prisma migrate deploy', {
      cwd: SERVICE_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    });

    prisma = new PrismaService();
    await prisma.onModuleInit();
    repo = new AuthRepository(prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await container.stop();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  const seed = {
    email: 'test@example.com',
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',
  };

  async function createTestUser() {
    return repo.createUser(seed);
  }

  describe('createUser / findUserByEmail', () => {
    it('persists a user and retrieves it by email', async () => {
      await createTestUser();
      const found = await repo.findUserByEmail(seed.email);

      expect(found).not.toBeNull();
      expect(found!.email).toBe(seed.email);
      expect(found!.firstName).toBe('Test');
    });

    it('returns null for a non-existent email', async () => {
      const found = await repo.findUserByEmail('nobody@example.com');
      expect(found).toBeNull();
    });
  });

  describe('createRefreshToken / findRefreshTokenByHash', () => {
    it('persists a token and retrieves it with the user relation', async () => {
      const user = await createTestUser();
      await repo.createRefreshToken({
        userId: user.id,
        familyId: 'fam-1',
        tokenHash: 'hash-abc',
        deviceId: 'dev-1',
        expiresAt: new Date(Date.now() + 3_600_000),
      });

      const found = await repo.findRefreshTokenByHash('hash-abc');

      expect(found).not.toBeNull();
      expect(found!.user.id).toBe(user.id);
      expect(found!.isRevoked).toBe(false);
    });
  });

  describe('revokeRefreshToken', () => {
    it('marks a token as revoked', async () => {
      const user = await createTestUser();
      const token = await repo.createRefreshToken({
        userId: user.id,
        familyId: 'fam-2',
        tokenHash: 'hash-def',
        deviceId: 'dev-2',
        expiresAt: new Date(Date.now() + 3_600_000),
      });

      await repo.revokeRefreshToken(token.id);

      const found = await repo.findRefreshTokenByHash('hash-def');
      expect(found!.isRevoked).toBe(true);
    });
  });

  describe('revokeTokenFamily', () => {
    it('revokes all tokens sharing a familyId', async () => {
      const user = await createTestUser();
      const familyId = 'fam-3';

      await Promise.all([
        repo.createRefreshToken({
          userId: user.id,
          familyId,
          tokenHash: 'h1',
          deviceId: 'd1',
          expiresAt: new Date(Date.now() + 3_600_000),
        }),
        repo.createRefreshToken({
          userId: user.id,
          familyId,
          tokenHash: 'h2',
          deviceId: 'd2',
          expiresAt: new Date(Date.now() + 3_600_000),
        }),
      ]);

      const result = await repo.revokeTokenFamily(familyId);
      expect(result.count).toBe(2);

      const active = await repo.countActiveSessions(user.id);
      expect(active).toBe(0);
    });
  });

  describe('countActiveSessions / revokeOldestSession', () => {
    it('counts only non-revoked, non-expired tokens', async () => {
      const user = await createTestUser();

      await repo.createRefreshToken({
        userId: user.id,
        familyId: 'f1',
        tokenHash: 'h-active',
        deviceId: 'd1',
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      await repo.createRefreshToken({
        userId: user.id,
        familyId: 'f2',
        tokenHash: 'h-expired',
        deviceId: 'd2',
        expiresAt: new Date(Date.now() - 1000),
      });

      const count = await repo.countActiveSessions(user.id);
      expect(count).toBe(1);
    });

    it('revokes the oldest session', async () => {
      const user = await createTestUser();

      // Insert two tokens with different creation times using raw timestamps
      const older = await repo.createRefreshToken({
        userId: user.id,
        familyId: 'f-old',
        tokenHash: 'h-old',
        deviceId: 'd1',
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      await repo.createRefreshToken({
        userId: user.id,
        familyId: 'f-new',
        tokenHash: 'h-new',
        deviceId: 'd2',
        expiresAt: new Date(Date.now() + 3_600_000),
      });

      await repo.revokeOldestSession(user.id);

      const olderNow = await repo.findRefreshTokenByHash('h-old');
      const newerNow = await repo.findRefreshTokenByHash('h-new');

      expect(olderNow!.isRevoked || newerNow!.isRevoked).toBe(true);
      // Exactly one revoked
      expect(olderNow!.isRevoked).not.toBe(newerNow!.isRevoked);
      // The older one (first inserted) should be the one revoked
      expect(olderNow!.isRevoked).toBe(true);
      void older; // used above
    });
  });
});
