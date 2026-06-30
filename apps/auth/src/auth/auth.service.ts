import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import * as argon2 from 'argon2';
import { Counter } from 'prom-client';
import { v4 as uuidv4 } from 'uuid';

import { ConflictException, NotFoundException, UnauthorizedException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

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

  private readonly logger = createLogger('auth');
  private readonly accessPrivateKey: Buffer;
  private readonly refreshPrivateKey: Buffer;

  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @InjectMetric('auth_registrations_total')
    private readonly registrationsCounter: Counter<string>,
    @InjectMetric('auth_logins_total')
    private readonly loginsCounter: Counter<string>,
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

    this.logger.info({ userId: user.id, email: user.email }, 'User registered');
    this.registrationsCounter.inc();

    return this.issueTokens(user, uuidv4(), uuidv4());
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.repo.findUserByEmail(dto.email.toLowerCase());

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      this.logger.warn({ email: dto.email.toLowerCase() }, 'Login failed: invalid credentials');
      this.loginsCounter.inc({ result: 'failure' });
      throw new UnauthorizedException('Invalid email or password');
    }

    const activeSessions = await this.repo.countActiveSessions(user.id);
    if (activeSessions >= AuthService.MAX_SESSIONS) {
      this.logger.info(
        { userId: user.id, activeSessions },
        'Max sessions reached, revoking oldest session',
      );
      await this.repo.revokeOldestSession(user.id);
    }

    this.logger.info({ userId: user.id, email: user.email }, 'User logged in');
    this.loginsCounter.inc({ result: 'success' });

    return this.issueTokens(user, uuidv4(), uuidv4());
  }

  async refresh(dto: RefreshDto): Promise<AuthTokensResponse> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.isRevoked) {
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
  }

  async internalGetUserById(userId: string): Promise<UserResponse> {
    const user = await this.repo.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User', userId);
    }

    return UserResponse.from(user);
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
        jwtid: uuidv4(),
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, deviceId, familyId, type: 'refresh' },
      {
        algorithm: 'RS256',
        privateKey: this.refreshPrivateKey,
        expiresIn: this.config.AUTH_JWT_REFRESH_EXPIRES_IN,
        jwtid: uuidv4(),
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
