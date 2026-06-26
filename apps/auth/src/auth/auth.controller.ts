import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from '@/auth/auth.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { LogoutDto } from '@/auth/dto/logout.dto';
import { RefreshDto } from '@/auth/dto/refresh.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { AuthTokensResponse } from '@/auth/responses/auth-tokens.response';
import { InternalAuthGuard } from '@/common/guards/internal-auth.guard';

import { UserResponse } from './responses/user.response';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('internal/users/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalAuthGuard)
  internalGetUserById(@Param('id') userId: string): Promise<UserResponse> {
    return this.authService.internalGetUserById(userId);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<AuthTokensResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthTokensResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: LogoutDto): Promise<void> {
    return this.authService.logout(dto);
  }
}
