import {
  BadRequestException,
  ConflictException,
  Injectable,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FirestoreService } from '../../common/firestore.service';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly config: ConfigService,
  ) {}

  private firebaseApp() {
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

  private async identity(authorization?: string) {
    const token = String(authorization || '').startsWith('Bearer ') ? String(authorization).slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Sign in before verifying your Gmail address.');
    try {
      const decoded = await getAuth(this.firebaseApp()).verifyIdToken(token, true);
      const provider = String((decoded as any).firebase?.sign_in_provider || '');
      const email = String(decoded.email || '').trim().toLowerCase();
      const allowedProviders = new Set(['password', 'google.com', 'facebook.com', 'twitter.com', 'github.com', 'apple.com', 'microsoft.com', 'phone']);
      if (!allowedProviders.has(provider)) {
        throw new UnauthorizedException('This Firebase sign-in provider is not enabled for CrickX.');
      }
      if (provider === 'password' && (!email || !email.endsWith('@gmail.com'))) {
        throw new UnauthorizedException('CrickX Email/Password signup requires a Gmail address ending in @gmail.com.');
      }
      return { uid: decoded.uid, email: email || null, provider, emailVerified: decoded.email_verified === true };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Your sign-in session is invalid or expired. Please sign in again.');
    }
  }

  private date(value: any): Date | null {
    if (value instanceof Date) return value;
    if (value && typeof value.toDate === 'function') {
      const result = value.toDate();
      return result instanceof Date && !Number.isNaN(result.getTime()) ? result : null;
    }
    if (value && typeof value === 'object' && typeof value._seconds === 'number') {
      return new Date(value._seconds * 1000 + Math.floor(Number(value._nanoseconds || 0) / 1_000_000));
    }
    if (value === null || value === undefined || value === '') return null;
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  private hashCode(uid: string, code: string) {
    return createHash('sha256').update(uid + ':' + code).digest('hex');
  }

  private async sendEmail(email: string, code: string) {
    const apiKey = String(this.config.get<string>('RESEND_API_KEY') || '').trim();
    const from = String(this.config.get<string>('RESEND_FROM_EMAIL') || this.config.get<string>('CRICKX_EMAIL_FROM') || '').trim();
    if (!apiKey || !from) {
      throw new ServiceUnavailableException('Email verification is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the CrickX API service in Render.');
    }

    const webUrl = String(this.config.get<string>('CRICKX_WEB_URL') || 'https://crickxfantasy.site').replace(/\/$/, '');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your CrickX verification code',
        text: 'Your CrickX verification code is ' + code + '. It expires in 10 minutes. If you did not try to sign up, you can ignore this email. ' + webUrl,
        html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#162018"><h1>Verify your CrickX account</h1><p>Enter this 6-digit code on CrickX to verify your Gmail address:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;padding:16px;background:#f2f5ef;border-radius:12px;text-align:center">' + code + '</p><p>This code expires in 10 minutes. Do not share it with anyone.</p><p>If you did not request this code, you can ignore this email.</p><p><a href="' + webUrl + '">' + webUrl + '</a></p></div>',
      }),
    });

    if (!response.ok) {
      // Keep provider details out of the API response; detailed errors belong in Render logs.
      const providerMessage = (await response.text()).slice(0, 500);
      console.error('CrickX verification email provider failed:', response.status, providerMessage);
      throw new ServiceUnavailableException('The verification email could not be delivered. Please check the email service configuration and retry.');
    }
  }

  async sendCode(authorization?: string) {
    const { uid, email, provider } = await this.identity(authorization);
    if (provider !== 'password' || !email) {
      throw new BadRequestException('The 6-digit email code is only for CrickX Email/Password accounts. Social and phone sign-in are verified by Firebase.');
    }
    const firebaseUser = await getAuth(this.firebaseApp()).getUser(uid);
    if (firebaseUser.emailVerified) {
      throw new ConflictException('This Gmail address is already verified. Please sign in to continue.');
    }
    const ref = this.firestore.db.collection('emailVerificationCodes').doc(uid);
    const existingSnapshot = await ref.get();
    const existing = existingSnapshot.exists ? (existingSnapshot.data() as any) : {};
    const now = new Date();
    const lastSentAt = this.date(existing.lastSentAt);
    if (lastSentAt && now.getTime() - lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException('Please wait 60 seconds before requesting another verification code.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const oldWindow = this.date(existing.windowStartedAt);
    const sameWindow = oldWindow && now.getTime() - oldWindow.getTime() < SEND_WINDOW_MS;
    const sendCount = sameWindow ? Number(existing.sendCount || 0) + 1 : 1;
    if (sendCount > MAX_SENDS_PER_WINDOW) {
      throw new HttpException('You have requested too many codes. Try again in about one hour.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
    await ref.set({
      id: uid,
      userId: uid,
      email,
      codeHash: this.hashCode(uid, code),
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      windowStartedAt: sameWindow ? oldWindow : now,
      sendCount,
      updatedAt: now,
    }, { merge: true });

    try {
      await this.sendEmail(email, code);
    } catch (error) {
      await ref.set({ codeHash: null, expiresAt: null, deliveryFailedAt: new Date() }, { merge: true });
      throw error;
    }

    return { sent: true, expiresInSeconds: Math.floor(CODE_TTL_MS / 1000) };
  }

  async activateTrial(authorization?: string) {
    const identity = await this.identity(authorization);
    const adminAuth = getAuth(this.firebaseApp());
    const firebaseUser = await adminAuth.getUser(identity.uid);
    if (identity.provider === 'password' && (!identity.emailVerified || !firebaseUser.emailVerified)) {
      throw new UnauthorizedException('Verify your Gmail address using the 6-digit code before starting the free trial.');
    }

    const trialRef = this.firestore.db.collection('userTrials').doc(identity.uid);
    let trialSnapshot = await trialRef.get();
    if (!trialSnapshot.exists) {
      // Start social/phone trials from Firebase account creation time so old accounts
      // cannot receive a fresh 7-day trial simply by signing in after this rollout.
      const createdAt = this.date(firebaseUser.metadata.creationTime) ?? new Date();
      const trialEndsAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialRef.set({
        id: identity.uid,
        userId: identity.uid,
        email: identity.email,
        provider: identity.provider,
        trialStartedAt: createdAt,
        trialEndsAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { merge: false });
      trialSnapshot = await trialRef.get();
    }

    const data = trialSnapshot.data() as any;
    const trialStartedAt = this.date(data?.trialStartedAt);
    const trialEndsAt = this.date(data?.trialEndsAt);
    return {
      activated: true,
      trialActive: !!trialEndsAt && trialEndsAt.getTime() > Date.now(),
      trialStartedAt: trialStartedAt?.toISOString() ?? null,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      trialDurationDays: 7,
    };
  }

  async verifyCode(authorization: string | undefined, inputCode: unknown) {
    const { uid, email, provider } = await this.identity(authorization);
    if (provider !== 'password' || !email) {
      throw new BadRequestException('Only CrickX Email/Password accounts can use the 6-digit email code.');
    }
    const code = String(inputCode ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Enter the 6-digit verification code.');

    const ref = this.firestore.db.collection('emailVerificationCodes').doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new BadRequestException('No active verification code was found. Request a new code.');
    const record = snapshot.data() as any;
    if (String(record.email || '').toLowerCase() !== email) {
      throw new UnauthorizedException('The verification code belongs to a different Gmail address.');
    }

    const expiresAt = this.date(record.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= Date.now() || !record.codeHash) {
      throw new BadRequestException('Your verification code has expired. Request a new code.');
    }
    const attempts = Number(record.attempts || 0);
    if (attempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpException('Too many incorrect codes. Request a new code.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const expected = Buffer.from(String(record.codeHash), 'hex');
    const supplied = Buffer.from(this.hashCode(uid, code), 'hex');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await ref.set({ attempts: attempts + 1, updatedAt: new Date() }, { merge: true });
      throw new BadRequestException('That verification code is incorrect. Please try again.');
    }

    // The Firebase Auth verified flag is authoritative for guarded API requests.
    await getAuth(this.firebaseApp()).updateUser(uid, { emailVerified: true });

    // This record is created once, keyed by Firebase UID, so re-login/resends cannot restart the trial.
    const trialRef = this.firestore.db.collection('userTrials').doc(uid);
    const trialSnapshot = await trialRef.get();
    if (!trialSnapshot.exists) {
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await trialRef.set({
        id: uid,
        userId: uid,
        email,
        trialStartedAt: now,
        trialEndsAt,
        createdAt: now,
        updatedAt: now,
      }, { merge: false });
    }

    await ref.delete();
    const trial = await trialRef.get();
    const data = trial.data() as any;
    return {
      verified: true,
      trialStartedAt: this.date(data?.trialStartedAt)?.toISOString() ?? null,
      trialEndsAt: this.date(data?.trialEndsAt)?.toISOString() ?? null,
      trialDurationDays: 7,
    };
  }
}
