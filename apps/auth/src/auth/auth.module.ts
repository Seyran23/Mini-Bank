import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from '@/auth/auth.controller';
import { AuthRepository } from '@/auth/auth.repository';
import { AuthService } from '@/auth/auth.service';
import { AUTH_CONFIG, authConfig } from '@/config/auth.config';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, { provide: AUTH_CONFIG, useValue: authConfig }],
})
export class AuthModule {}
