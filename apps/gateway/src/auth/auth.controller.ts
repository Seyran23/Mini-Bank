import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokensResponse } from './responses/auth-tokens.response';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user and receive access/refresh tokens' })
  @ApiOkResponse({ type: AuthTokensResponse })
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const { status, body } = await this.authService.register(dto, correlationId);
    reply.status(status).send(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: AuthTokensResponse })
  async login(
    @Body() dto: LoginDto,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const { status, body } = await this.authService.login(dto, correlationId);
    reply.status(status).send(body);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiOkResponse({ type: AuthTokensResponse })
  async refresh(
    @Body() dto: RefreshDto,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const { status, body } = await this.authService.refresh(dto, correlationId);
    reply.status(status).send(body);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(
    @Body() dto: LogoutDto,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const { status, body } = await this.authService.logout(dto, correlationId);
    reply.status(status).send(body);
  }
}
