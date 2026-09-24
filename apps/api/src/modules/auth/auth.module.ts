import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { FirestoreService } from '../../common/firestore.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = String(config.get<string>('JWT_ACCESS_SECRET') || '').trim();
        if (secret.length < 32 || /change_me|replace_me|default/i.test(secret)) {
          throw new Error('JWT_ACCESS_SECRET must be a unique secret of at least 32 characters.');
        }
        return {
          secret,
          signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', '15m') },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, FirestoreService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
