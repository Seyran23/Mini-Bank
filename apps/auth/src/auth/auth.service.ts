import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { ConflictException, UnauthorizedException } from '@minibank/errors';

import { AuthRepository } from '@/auth/auth.repository';
import { hashToken, parseExpiryToDate } from '@/auth/auth.utils';
import { LoginDto } from '@/auth/dto/login.dto';
import { LogoutDto } from '@/auth/dto/logout.dto';
import { RefreshDto } from '@/auth/dto/refresh.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { AuthTokensResponse } from '@/auth/responses/auth-tokens.response';
import { UserResponse } from '@/auth/responses/user.response';
import { AUTH_CONFIG, type AuthConfig } from '@/config/auth.config';
import { User } from '@/generated/prisma';

@Injectable()
export class AuthService {
  private static readonly MAX_SESSIONS = 5;

  private readonly accessPrivateKey: Buffer;
  private readonly refreshPrivateKey: Buffer;

  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {
    this.accessPrivateKey = Buffer.from(config.AUTH_JWT_ACCESS_PRIVATE_KEY_BASE64, 'base64');
    this.refreshPrivateKey = Buffer.from(config.AUTH_JWT_REFRESH_PRIVATE_KEY_BASE64, 'base64');
  }

  async register(dto: RegisterDto): Promise<AuthTokensResponse> {
    const existing = await this.repo.findUserByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.repo.createUser({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    return this.issueTokens(user, uuidv4(), uuidv4());
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.repo.findUserByEmail(dto.email.toLowerCase());

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const activeSessions = await this.repo.countActiveSessions(user.id);
    if (activeSessions >= AuthService.MAX_SESSIONS) {
      await this.repo.revokeOldestSession(user.id);
    }

    return this.issueTokens(user, uuidv4(), uuidv4());
  }

  async refresh(dto: RefreshDto): Promise<AuthTokensResponse> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.isRevoked) {
      // Token was already used — this is a replay attack. Invalidate the whole login session.
      await this.repo.revokeTokenFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      await this.repo.revokeRefreshToken(stored.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.repo.revokeRefreshToken(stored.id);

    return this.issueTokens(stored.user, stored.familyId, stored.deviceId);
  }

  async logout(dto: LogoutDto): Promise<void> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);
    if (stored && !stored.isRevoked) {
      await this.repo.revokeRefreshToken(stored.id);
    }
    // Intentionally idempotent — no error if token is unknown or already revoked
  }

  private async issueTokens(
    user: User,
    familyId: string,
    deviceId: string,
  ): Promise<AuthTokensResponse> {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, type: 'access' },
      {
        algorithm: 'RS256',
        privateKey: this.accessPrivateKey,
        expiresIn: this.config.AUTH_JWT_ACCESS_EXPIRES_IN,
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, deviceId, familyId, type: 'refresh' },
      {
        algorithm: 'RS256',
        privateKey: this.refreshPrivateKey,
        expiresIn: this.config.AUTH_JWT_REFRESH_EXPIRES_IN,
      },
    );

    await this.repo.createRefreshToken({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      deviceId,
      expiresAt: parseExpiryToDate(this.config.AUTH_JWT_REFRESH_EXPIRES_IN),
    });

    return {
      accessToken,
      refreshToken,
      deviceId,
      user: UserResponse.from(user),
    };
  }
}
