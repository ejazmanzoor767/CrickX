import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { FirestoreService } from '../firestore.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly firestore: FirestoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required.');

    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedException('Authentication required.');

    try {
      const decoded = await getAuth().verifyIdToken(token, true);
      const email = decoded.email?.trim().toLowerCase();
      if (!email) throw new UnauthorizedException('Firebase account has no email address.');

      let user = await this.firestore.user.findUnique({ where: { id: decoded.uid } });
      if (!user) {
        user = await this.firestore.user.findUnique({ where: { email } });
      }

      if (!user) {
        user = await this.firestore.user.create({
          data: {
            id: decoded.uid,
            email,
            passwordHash: 'FIREBASE_AUTH_MANAGED',
            role: 'USER',
            status: 'ACTIVE',
            emailVerifiedAt: decoded.email_verified ? new Date() : undefined,
            profile: { create: { displayName: decoded.name || email.split('@')[0] || 'Player' } },
            wallet: { create: {} },
          },
          include: { profile: true },
        });
      } else if ((user as any).firebaseUid !== decoded.uid) {
        await this.firestore.user.update({
          where: { id: user.id },
          data: {
            firebaseUid: decoded.uid,
            emailVerifiedAt: decoded.email_verified ? new Date() : (user as any).emailVerifiedAt,
            lastLoginAt: new Date(),
          },
        });
      }

      if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
        throw new UnauthorizedException(`Account is ${String(user.status).toLowerCase()}.`);
      }

      request.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        firebaseUid: decoded.uid,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired Firebase authentication token.');
    }
  }
}
