import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { cert, getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const USER_CACHE_TTL_MS = 60_000;

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
  userCache.set(firebaseUid, { ...user, cachedAt: Date.now() });
  return user;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

      const db = getFirestore(app);
      const users = db.collection('users');
      const uidRef = users.doc(decoded.uid);
      let userSnap = await uidRef.get();

      if (!userSnap.exists) {
        const byEmail = await users.where('email', '==', email).limit(1).get();
        if (!byEmail.empty) {
          const existing = byEmail.docs[0];
          await existing.ref.set({ firebaseUid: decoded.uid, emailVerifiedAt: decoded.email_verified ? new Date() : null, lastLoginAt: new Date() }, { merge: true });
          userSnap = await existing.ref.get();
        } else {
          const now = new Date();
          await uidRef.set({
            id: decoded.uid,
            email,
            passwordHash: 'FIREBASE_AUTH_MANAGED',
            role: 'USER',
            status: 'ACTIVE',
            emailVerifiedAt: decoded.email_verified ? now : null,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
          });
          const profileId = randomUUID();
          await db.collection('profiles').doc(profileId).set({ id: profileId, userId: decoded.uid, displayName: decoded.name || email.split('@')[0] || 'Player', country: 'IN', createdAt: now, updatedAt: now });
          await db.collection('wallets').doc(decoded.uid).set({ id: decoded.uid, userId: decoded.uid, depositBalance: 0, winningsBalance: 0, bonusBalance: 0, currency: 'INR', version: 0, createdAt: now, updatedAt: now });
          userSnap = await uidRef.get();
        }
      }

      const user = userSnap.data() as any;
      if (user?.status === 'SUSPENDED' || user?.status === 'BANNED') {
        throw new UnauthorizedException(`Account is ${String(user.status).toLowerCase()}.`);
      }

      const currentUser = putUserCache(decoded.uid, {
        userId: userSnap.id,
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
