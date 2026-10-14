import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';

@Injectable()
export class FantasyDraftService {
  constructor(
    private readonly firestore: FirestoreService,
    private readonly sportmonks: SportmonksDataService,
  ) {}

  private id(userId: string, fixtureId: number) {
    return `${userId}_${fixtureId}`;
  }

  async get(userId: string, fixtureId: number) {
    const draft = await this.firestore.db.collection('fantasyTeamDrafts').doc(this.id(userId, fixtureId)).get();
    return draft.exists ? { id: draft.id, ...(draft.data() as Record<string, unknown>) } : null;
  }

  async save(userId: string, fixtureId: number, payload: {
    name?: string;
    sportmonksPlayerIds?: number[];
    captainSportmonksPlayerId?: number | null;
    viceCaptainSportmonksPlayerId?: number | null;
  }) {
    const fixture = await this.sportmonks.getFixture(fixtureId, { forceLive: false });
    if (new Date(fixture.starting_at) <= new Date() || fixture.live === 1) {
      throw new ForbiddenException('This fantasy draft is locked because the match has started.');
    }

    const playerIds = Array.isArray(payload.sportmonksPlayerIds)
      ? [...new Set(payload.sportmonksPlayerIds.map(Number).filter((id) => Number.isFinite(id)))]
      : [];

    const captainId = payload.captainSportmonksPlayerId ?? null;
    const viceCaptainId = payload.viceCaptainSportmonksPlayerId ?? null;
    if (captainId !== null && !playerIds.includes(Number(captainId))) throw new BadRequestException('Captain must be one of the selected players.');
    if (viceCaptainId !== null && !playerIds.includes(Number(viceCaptainId))) throw new BadRequestException('Vice-captain must be one of the selected players.');
    if (captainId !== null && viceCaptainId !== null && Number(captainId) === Number(viceCaptainId)) throw new BadRequestException('Captain and vice-captain must be different players.');

    const ref = this.firestore.db.collection('fantasyTeamDrafts').doc(this.id(userId, fixtureId));
    const now = new Date();
    const snapshot = await ref.get();
    const data = {
      userId,
      sportmonksFixtureId: fixtureId,
      name: String(payload.name ?? 'My CrickX XI').slice(0, 80),
      sportmonksPlayerIds: playerIds.slice(0, 11),
      captainSportmonksPlayerId: captainId,
      viceCaptainSportmonksPlayerId: viceCaptainId,
      updatedAt: now,
      ...(snapshot.exists ? {} : { createdAt: now }),
    };
    await ref.set(data, { merge: true });
    return { id: ref.id, ...data };
  }

  async clear(userId: string, fixtureId: number) {
    await this.firestore.db.collection('fantasyTeamDrafts').doc(this.id(userId, fixtureId)).delete();
    return { ok: true };
  }
}
