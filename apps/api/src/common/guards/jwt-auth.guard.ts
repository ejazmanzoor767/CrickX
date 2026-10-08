import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { cert, getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FirestoreService } from '../firestore.service';

const USER_CACHE_TTL_MS = 5_000;
const MAX_USER_CACHE_ENTRIES = 5_000;

type CachedUser = {
  userId: string;
  email: string;
  role: string;
  status?: string;
  cachedAt: number;
};

const userCache = new Map<string, CachedUser>();

function getFirebaseApp() {
  if (getApps().length) return getApp();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return initializeApp({ credential: cert(JSON.parse(raw)) });
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'crickx-3d806';
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    return initializeApp({ credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }) });
  }
  return initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'crickx-3d806' });
}

function cachedUser(firebaseUid: string) {
  const entry = userCache.get(firebaseUid);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > USER_CACHE_TTL_MS) {
    userCache.delete(firebaseUid);
    return null;
  }
  return entry;
}

function putUserCache(firebaseUid: string, user: CachedUser) {
  if (!userCache.has(firebaseUid) && userCache.size >= MAX_USER_CACHE_ENTRIES) {
    const oldestKey = userCache.keys().next().value;
    if (oldestKey) userCache.delete(oldestKey);
  }
  userCache.set(firebaseUid, { ...user, cachedAt: Date.now() });
  return user;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: FirestoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required.');
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedException('Authentication required.');

    try {
      const app = getFirebaseApp();
      const decoded = await getAuth(app).verifyIdToken(token, true);
      const email = decoded.email?.trim().toLowerCase();
      if (!email) throw new UnauthorizedException('Firebase account has no email address.');

      const hit = cachedUser(decoded.uid);
      if (hit) {
        if (hit.status === 'SUSPENDED' || hit.status === 'BANNED') {
          throw new UnauthorizedException(`Account is ${String(hit.status).toLowerCase()}.`);
        }
        request.user = {
          userId: hit.userId,
          email: hit.email || email,
          role: hit.role || 'USER',
          firebaseUid: decoded.uid,
        };
        return true;
      }

      // Firebase is the authentication provider, while Neon/PostgreSQL is the
      // application source of truth. Ensure every authenticated Firebase user
      // has the corresponding application user/profile/wallet records in Neon.
      let user = await this.prisma.user.findUnique({ where: { id: decoded.uid } });
      const userMatchedByEmail = !user;
      if (!user) {
        user = await this.prisma.user.findFirst({ where: { email } });
        if (user && user.id !== decoded.uid && !decoded.email_verified) {
          throw new UnauthorizedException('Verify your Firebase email before linking this existing CrickX account.');
        }
      }

      const now = new Date();
      if (!user) {
        try {
          user = await this.prisma.user.create({
            data: {
              id: decoded.uid,
              email,
              passwordHash: 'FIREBASE_AUTH_MANAGED',
              role: 'USER',
              status: 'ACTIVE',
              emailVerifiedAt: decoded.email_verified ? now : null,
              lastLoginAt: now,
              profile: {
                create: {
                  displayName: decoded.name || email.split('@')[0] || 'Player',
                  country: 'PK',
                },
              },
              wallet: {
                create: {
                  id: decoded.uid,
                  depositBalance: 0,
                  winningsBalance: 0,
                  bonusBalance: 0,
                  currency: 'CRX',
                  version: 0,
                },
              },
            },
          });
        } catch {
          // A concurrent first request may have created the same user.
          user = await this.prisma.user.findUnique({ where: { id: decoded.uid } });
          const fallbackByEmail = user ? null : await this.prisma.user.findFirst({ where: { email } });
          if (!user && fallbackByEmail && fallbackByEmail.id !== decoded.uid && !decoded.email_verified) {
            throw new UnauthorizedException('Verify your Firebase email before linking this existing CrickX account.');
          }
          user = user ?? fallbackByEmail;
          if (!user) throw new UnauthorizedException('Unable to initialize your CrickX account.');
        }
      }

      if (userMatchedByEmail && user.id !== decoded.uid && !decoded.email_verified) {
        throw new UnauthorizedException('Verify your Firebase email before linking this existing CrickX account.');
      }

      if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
        throw new UnauthorizedException(`Account is ${String(user.status).toLowerCase()}.`);
      }

      // Repair legacy/incomplete records without overwriting existing profile data.
      const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
      if (!profile) {
        await this.prisma.profile.create({
          data: {
            userId: user.id,
            displayName: decoded.name || email.split('@')[0] || 'Player',
            country: 'PK',
          },
        });
      }

      const wallet = await this.prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        await this.prisma.wallet.create({
          data: {
            id: user.id,
            userId: user.id,
            depositBalance: 0,
            winningsBalance: 0,
            bonusBalance: 0,
            currency: 'CRX',
            version: 0,
          },
        });
      }

      if (user.email !== email || !user.lastLoginAt) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: decoded.email_verified ? (user.emailVerifiedAt ?? now) : user.emailVerifiedAt,
            lastLoginAt: now,
          },
        });
      } else {
        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
      }

      const currentUser = putUserCache(decoded.uid, {
        userId: user.id,
        email: user.email || email,
        role: user.role || 'USER',
        status: user.status,
        cachedAt: Date.now(),
      });

      request.user = {
        userId: currentUser.userId,
        email: currentUser.email,
        role: currentUser.role,
        firebaseUid: decoded.uid,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired Firebase authentication token.');
    }
  }
}
