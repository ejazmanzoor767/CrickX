import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { cert, getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

function getFirebaseApp() {
  if (getApps().length) return getApp();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'crickx-3d806' });
  return initializeApp({ credential: cert(JSON.parse(raw)) });
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
      if (user?.status === 'SUSPENDED' || user?.status === 'BANNED') throw new UnauthorizedException(`Account is ${String(user.status).toLowerCase()}.`);

      request.user = { userId: userSnap.id, email: user.email || email, role: user.role || 'USER', firebaseUid: decoded.uid };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired Firebase authentication token.');
    }
  }
}
