import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../common/firestore.service';

type MatchScore = {
  userId: string;
  fixtureId: number;
  format: string;
  points: number;
};

@Injectable()
export class LeaderboardService {
  private readonly matchScores = 'leaderboardMatchScores';
  private readonly users = 'leaderboardUsers';

  constructor(private readonly firestore: FirestoreService) {}

  private matchScoreId(userId: string, fixtureId: number) {
    return `${userId}_${fixtureId}`;
  }

  private safeLimit(limit: number) {
    return Math.max(1, Math.min(Number.isFinite(Number(limit)) ? Number(limit) : 100, 100));
  }

  private async profilesForUserIds(userIds: string[]) {
    const result = new Map<string, Record<string, any>>();
    const unique = [...new Set(userIds.map(String).filter(Boolean))];
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      if (!chunk.length) continue;
      const snap = await this.firestore.db.collection('profiles')
        .where('userId', 'in', chunk)
        .get();
      for (const doc of snap.docs) {
        const row = doc.data() as Record<string, any>;
        result.set(String(row.userId), row);
      }
    }
    return result;
  }

  async recordFixtureScores(scores: MatchScore[]) {
    if (!scores.length) return [];

    const batch = this.firestore.db.batch();
    const now = new Date();
    for (const score of scores) {
      const ref = this.firestore.db.collection(this.matchScores).doc(this.matchScoreId(score.userId, score.fixtureId));
      batch.set(ref, {
        userId: score.userId,
        fixtureId: score.fixtureId,
        format: score.format,
        points: Number(score.points) || 0,
        updatedAt: now,
      }, { merge: true });
    }
    await batch.commit();
    return this.rebuildGlobal();
  }

  async rebuildGlobal() {
    const [matchSnap, previousSnap, profiles] = await Promise.all([
      this.firestore.db.collection(this.matchScores).get(),
      this.firestore.db.collection(this.users).get(),
      this.profileMap(),
    ]);

    const aggregate = new Map<string, {
      totalPoints: number;
      matchesPlayed: number;
      lastPoints: number;
      lastFixtureId: number | null;
      lastFormat: string | null;
      lastUpdatedAt: number;
    }>();

    for (const doc of matchSnap.docs) {
      const row = doc.data() as Record<string, any>;
      const userId = String(row.userId);
      const timestamp = row.updatedAt?.toDate?.();
      const updatedAt = timestamp instanceof Date
        ? timestamp.getTime()
        : (new Date(row.updatedAt ?? 0).getTime() || 0);
      const current = aggregate.get(userId) ?? {
        totalPoints: 0,
        matchesPlayed: 0,
        lastPoints: 0,
        lastFixtureId: null,
        lastFormat: null,
        lastUpdatedAt: 0,
      };

      current.totalPoints += Number(row.points) || 0;
      current.matchesPlayed += 1;
      if (updatedAt >= current.lastUpdatedAt) {
        current.lastUpdatedAt = updatedAt;
        current.lastPoints = Number(row.points) || 0;
        current.lastFixtureId = Number(row.fixtureId) || null;
        current.lastFormat = row.format ? String(row.format) : null;
      }
      aggregate.set(userId, current);
    }

    const rows = [...aggregate.entries()]
      .map(([userId, value]) => ({ userId, ...value }))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.lastPoints - a.lastPoints || a.userId.localeCompare(b.userId));

    const previousRanks = new Map(
      previousSnap.docs.map((doc) => [doc.id, Number(doc.data().rank) || 0]),
    );
    const batch = this.firestore.db.batch();
    const now = new Date();

    for (const [index, row] of rows.entries()) {
      const rank = index + 1;
      const previousRank = previousRanks.get(row.userId) || null;
      const profile = profiles.get(row.userId) as Record<string, any> | undefined;
      const ref = this.firestore.db.collection(this.users).doc(row.userId);

      batch.set(ref, {
        userId: row.userId,
        displayName: profile?.displayName ?? 'CrickX Player',
        avatarUrl: profile?.avatarUrl ?? null,
        totalPoints: Math.round(row.totalPoints * 10) / 10,
        matchesPlayed: row.matchesPlayed,
        lastMatchPoints: Math.round(row.lastPoints * 10) / 10,
        lastFixtureId: row.lastFixtureId,
        lastFormat: row.lastFormat,
        previousRank,
        rank,
        rankChange: previousRank ? previousRank - rank : 0,
        updatedAt: now,
      }, { merge: true });
    }

    if (rows.length) await batch.commit();
    return rows;
  }

  async global(limit = 100) {
    const safeLimit = this.safeLimit(limit);
    const snap = await this.firestore.db.collection(this.users)
      .orderBy('rank', 'asc')
      .limit(safeLimit)
      .get();
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const profiles = await this.profilesForUserIds(rows.map((row: any) => String(row.userId)));
    return rows.map((row: any) => {
      const profile = profiles.get(String(row.userId));
      return {
        ...row,
        displayName: profile?.displayName ?? row.displayName ?? 'CrickX Player',
        avatarUrl: profile?.avatarUrl ?? row.avatarUrl ?? null,
      };
    });
  }

  async me(userId: string) {
    const doc = await this.firestore.db.collection(this.users).doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async fixture(fixtureId: number, limit = 100) {
    const safeLimit = this.safeLimit(limit);
    const [scoreSnap, teamSnap] = await Promise.all([
      this.firestore.db.collection(this.matchScores)
        .where('fixtureId', '==', fixtureId)
        .orderBy('points', 'desc')
        .limit(safeLimit)
        .get(),
      this.firestore.db.collection('fantasyTeams')
        .where('sportmonksFixtureId', '==', fixtureId)
        .limit(safeLimit)
        .get(),
    ]);

    const scoresByUser = new Map<string, Record<string, any>>();
    for (const doc of scoreSnap.docs) {
      const row = doc.data() as Record<string, any>;
      scoresByUser.set(String(row.userId), row);
    }

    const users = new Map<string, any>();
    for (const doc of teamSnap.docs) {
      const team = doc.data() as Record<string, any>;
      const userId = String(team.userId);
      const score = scoresByUser.get(userId);
      users.set(userId, {
        id: this.matchScoreId(userId, fixtureId),
        userId,
        fixtureId,
        format: score?.format ?? null,
        points: Number(score?.points) || 0,
        hasScore: Boolean(score),
      });
    }

    for (const [userId, score] of scoresByUser.entries()) {
      if (users.has(userId)) continue;
      users.set(userId, {
        id: this.matchScoreId(userId, fixtureId),
        userId,
        fixtureId,
        format: score.format ?? null,
        points: Number(score.points) || 0,
        hasScore: true,
      });
    }

    const rows = [...users.values()]
      .sort((a, b) => Number(b.points) - Number(a.points) || String(a.userId).localeCompare(String(b.userId)))
      .slice(0, safeLimit);

    const profiles = await this.profilesForUserIds(rows.map((row) => String(row.userId)));
    return rows.map((row, index) => {
      const profile = profiles.get(String(row.userId));
      return {
        ...row,
        displayName: profile?.displayName ?? 'CrickX Player',
        avatarUrl: profile?.avatarUrl ?? null,
        rank: index + 1,
      };
    });
  }

  async contest(contestId: string, limit = 100) {
    const safeLimit = this.safeLimit(limit);
    const snap = await this.firestore.db.collection('contestEntries')
      .where('contestId', '==', contestId)
      .orderBy('totalPoints', 'desc')
      .limit(safeLimit)
      .get();
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    const profiles = await this.profilesForUserIds(rows.map((row: any) => String(row.userId)));
    return rows.map((entry: any, index) => {
      const profile = profiles.get(String(entry.userId));
      return {
        id: entry.id,
        userId: entry.userId,
        fantasyTeamId: entry.fantasyTeamId,
        points: Number(entry.totalPoints) || 0,
        rank: Number(entry.rank) || index + 1,
        prizeWon: Number(entry.prizeWon) || 0,
        displayName: profile?.displayName ?? 'CrickX Player',
        avatarUrl: profile?.avatarUrl ?? null,
      };
    });
  }

}
