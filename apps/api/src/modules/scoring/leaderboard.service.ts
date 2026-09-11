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

  private async profileMap() {
    const snap = await this.firestore.db.collection('profiles').get();
    return new Map(snap.docs.map((doc) => [String(doc.data().userId), doc.data()]));
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
    const snap = await this.firestore.db.collection(this.users).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => Number(a.rank) - Number(b.rank))
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }

  async me(userId: string) {
    const doc = await this.firestore.db.collection(this.users).doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async fixture(fixtureId: number, limit = 100) {
    const [scoreSnap, teamRows, profiles] = await Promise.all([
      this.firestore.db.collection(this.matchScores).where('fixtureId', '==', fixtureId).get(),
      this.firestore.findMany('fantasyTeam', {
        where: { sportmonksFixtureId: fixtureId },
        select: { id: true, userId: true, sportmonksFixtureId: true },
      }),
      this.profileMap(),
    ]);

    // A fixture leaderboard must contain every user who created a fantasy team
    // for this match, even when the scoring job has not written a score row yet.
    // This prevents users from disappearing from the leaderboard between
    // lineup announcement, match start, and the next scoring cycle.
    const scoresByUser = new Map<string, Record<string, any>>();
    for (const doc of scoreSnap.docs) {
      const row = doc.data() as Record<string, any>;
      scoresByUser.set(String(row.userId), row);
    }

    const users = new Map<string, any>();
    for (const team of teamRows) {
      const userId = String(team.userId);
      const profile = profiles.get(userId) as Record<string, any> | undefined;
      const score = scoresByUser.get(userId);
      users.set(userId, {
        id: this.matchScoreId(userId, fixtureId),
        userId,
        fixtureId,
        format: score?.format ?? null,
        points: Number(score?.points) || 0,
        displayName: profile?.displayName ?? 'CrickX Player',
        avatarUrl: profile?.avatarUrl ?? null,
        hasScore: Boolean(score),
      });
    }

    // Preserve score rows for users whose fantasy team record may have been
    // removed later, so historical leaderboard data is not silently lost.
    for (const [userId, score] of scoresByUser.entries()) {
      if (users.has(userId)) continue;
      const profile = profiles.get(userId) as Record<string, any> | undefined;
      users.set(userId, {
        id: this.matchScoreId(userId, fixtureId),
        userId,
        fixtureId,
        format: score.format ?? null,
        points: Number(score.points) || 0,
        displayName: profile?.displayName ?? 'CrickX Player',
        avatarUrl: profile?.avatarUrl ?? null,
        hasScore: true,
      });
    }

    return [...users.values()]
      .sort((a, b) => Number(b.points) - Number(a.points) || String(a.displayName).localeCompare(String(b.displayName)))
      .slice(0, Math.max(1, Math.min(limit, 200)))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async contest(contestId: string, limit = 100) {
    const entries = await this.firestore.findMany('contestEntry', {
      where: { contestId },
      orderBy: { totalPoints: 'desc' },
    });
    const profiles = await this.profileMap();
    return entries
      .slice(0, Math.max(1, Math.min(limit, 200)))
      .map((entry: any, index) => {
        const profile = profiles.get(String(entry.userId)) as Record<string, any> | undefined;
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
