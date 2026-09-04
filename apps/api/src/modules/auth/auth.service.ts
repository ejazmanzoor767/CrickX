import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { RegisterDto, LoginDto } from './dto';

const REFRESH_TOKEN_BYTES = 48;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(user: { id: string; email: string; role: string }) {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );
  }

  private async issueRefreshToken(userId: string, ua?: string, ip?: string) {
    const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    const days = parseInt(ttl) || 30;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        userAgent: ua,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return raw;
  }

  async register(dto: RegisterDto, ip?: string, ua?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        profile: { create: { displayName: dto.displayName } },
        wallet: { create: {} },
      },
      include: { profile: true },
    });

    await this.prisma.authAuditLog.create({
      data: { userId: user.id, event: 'REGISTER', ipAddress: ip, userAgent: ua },
    });

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, ua, ip);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, displayName: dto.displayName } };
  }

  async login(dto: LoginDto, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.prisma.authAuditLog.create({ data: { userId: user.id, event: 'LOGIN_FAILED', ipAddress: ip, userAgent: ua } });
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}.`);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.prisma.authAuditLog.create({ data: { userId: user.id, event: 'LOGIN_SUCCESS', ipAddress: ip, userAgent: ua } });

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, ua, ip);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  }

  /** Rotates the refresh token on every use (reuse detection: old hash is deleted, not reusable). */
  async refresh(rawToken: string, ip?: string, ua?: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired.');
    }

    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    const accessToken = this.signAccessToken(record.user);
    const newRefreshToken = await this.issueRefreshToken(record.userId, ua, ip);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    return { success: true };
  }
}
