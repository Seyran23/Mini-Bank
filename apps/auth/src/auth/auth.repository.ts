import { Injectable } from '@nestjs/common';
import { RefreshToken, User } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

export type RefreshTokenWithUser = RefreshToken & { user: User };

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createRefreshToken(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    deviceId: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  revokeTokenFamily(familyId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: { isRevoked: true },
    });
  }

  countActiveSessions(userId: string): Promise<number> {
    return this.prisma.refreshToken.count({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    });
  }

  revokeOldestSession(userId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const oldest = await tx.refreshToken.findFirst({
        where: { userId, isRevoked: false },
        orderBy: { createdAt: 'asc' },
      });
      if (oldest) {
        await tx.refreshToken.update({
          where: { id: oldest.id },
          data: { isRevoked: true },
        });
      }
    });
  }
}
