import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

import { AuthController } from '@/auth/auth.controller';
import { AuthRepository } from '@/auth/auth.repository';
import { AuthService } from '@/auth/auth.service';
import { AUTH_CONFIG, authConfig } from '@/config/auth.config';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    { provide: AUTH_CONFIG, useValue: authConfig },
    makeCounterProvider({
      name: 'auth_registrations_total',
      help: 'Total successful user registrations',
    }),
    makeCounterProvider({
      name: 'auth_logins_total',
      help: 'Total login attempts',
      labelNames: ['result'],
    }),
  ],
})
export class AuthModule {}
