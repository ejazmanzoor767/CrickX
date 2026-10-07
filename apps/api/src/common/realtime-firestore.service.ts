import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

@Injectable()
export class RealtimeFirestoreService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeFirestoreService.name);
  private firestore: Firestore | null = null;
  private app: App | null = null;

  onModuleInit() {
    const projectId = String(process.env.FIREBASE_PROJECT_ID ?? '').trim();
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? '').trim();
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firestore realtime projection is disabled because Firebase Admin credentials are not configured.');
      return;
    }

    try {
      const name = 'crickx-realtime';
      const existingApp = getApps().find((candidate) => candidate.name === name);
      this.app = existingApp ?? initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      }, name);
      this.firestore = getFirestore(this.app);
      this.firestore.settings({ ignoreUndefinedProperties: true });
      this.logger.log('Firebase Firestore realtime projection enabled.');
    } catch (error) {
      this.firestore = null;
      this.app = null;
      this.logger.warn(
        'Firebase Firestore realtime projection could not start: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  isEnabled() {
    return this.firestore !== null;
  }

  get db(): Firestore {
    if (!this.firestore) {
      throw new Error('Firebase Firestore realtime projection is not configured.');
    }
    return this.firestore;
  }
}
