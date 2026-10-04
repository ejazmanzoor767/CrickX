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

    // Keep only the latest score for each user/fixture pair in this write.
    const normalized = [...new Map(
      scores.map((score) => [
        this.matchScoreId(String(score.userId), Number(score.fixtureId)),
        {
          userId: String(score.userId),
          fixtureId: Number(score.fixtureId),
          format: String(score.format ?? ''),
          points: Number(score.points) || 0,
        },
      ]),
    ).values()];

    const missingProfileIds = new Set<string>();
    const now = new Date();
    const matchRefs = normalized.map((score) =>
      this.firestore.db.collection(this.matchScores).doc(this.matchScoreId(score.userId, score.fixtureId)),
    );
    const userRefs = normalized.map((score) =>
      this.firestore.db.collection(this.users).doc(score.userId),
    );

    await this.firestore.db.runTransaction(async (tx) => {
      // Read all state first; only then issue transaction writes.
      const matchSnapshots = await Promise.all(matchRefs.map((ref) => tx.get(ref)));
      const userSnapshots = await Promise.all(userRefs.map((ref) => tx.get(ref)));

      normalized.forEach((score, index) => {
        const oldMatch = matchSnapshots[index].exists
          ? (matchSnapshots[index].data() as Record<string, any>)
          : null;
        const oldUser = userSnapshots[index].exists
          ? (userSnapshots[index].data() as Record<string, any>)
          : null;

        if (!oldUser) missingProfileIds.add(score.userId);

        const previousPoints = Number(oldMatch?.points) || 0;
        const previousTotal = Number(oldUser?.totalPoints) || 0;
        const delta = oldMatch ? score.points - previousPoints : score.points;
        const totalPoints = Math.round((previousTotal + delta) * 10) / 10;
        const matchesPlayed = Number(oldUser?.matchesPlayed) || 0;
        const nextMatchesPlayed = oldMatch ? matchesPlayed : matchesPlayed + 1;
        const displayName = oldUser?.displayName || 'CrickX Player';
        const avatarUrl = oldUser?.avatarUrl ?? null;

        tx.set(matchRefs[index], {
          userId: score.userId,
          fixtureId: score.fixtureId,
          format: score.format,
          points: score.points,
          displayName,
          avatarUrl,
          updatedAt: now,
        }, { merge: true });

        tx.set(userRefs[index], {
          userId: score.userId,
          displayName,
          avatarUrl,
          totalPoints,
          matchesPlayed: nextMatchesPlayed,
          lastMatchPoints: score.points,
          lastFixtureId: score.fixtureId,
          lastFormat: score.format || null,
          updatedAt: now,
          // Rank is computed dynamically by global(); it is not rebuilt on every
          // live scoring tick. Keeping the old value here preserves compatibility
          // for older records without making it a source of truth.
          rank: oldUser?.rank ?? null,
          previousRank: oldUser?.previousRank ?? null,
          rankChange: 0,
        }, { merge: true });
      });
    });

    // Profile reads happen only for first-time leaderboard users, not on every
    // 30-second scoring update. Cache the resolved name/avatar in both collections.
    if (missingProfileIds.size) {
      const profiles = await this.profilesForUserIds([...missingProfileIds]);
      if (profiles.size) {
        const profileBatch = this.firestore.db.batch();
        for (const userId of missingProfileIds) {
          const profile = profiles.get(userId);
          if (!profile) continue;
          const patch = {
            displayName: profile.displayName ?? 'CrickX Player',
            avatarUrl: profile.avatarUrl ?? null,
          };
          profileBatch.set(this.firestore.db.collection(this.users).doc(userId), patch, { merge: true });
          const userScore = normalized.find((score) => score.userId === userId);
          if (userScore) {
            profileBatch.set(
              this.firestore.db.collection(this.matchScores).doc(this.matchScoreId(userId, userScore.fixtureId)),
              patch,
              { merge: true },
            );
          }
        }
        await profileBatch.commit();
      }
    }

    return normalized;
  }

  async global(limit = 100) {
    const safeLimit = this.safeLimit(limit);
    const snap = await this.firestore.db.collection(this.users)
      .orderBy('totalPoints', 'desc')
      .limit(safeLimit)
      .get();
    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Rank is derived from the current ordered result. This avoids maintaining
    // every user's rank on every live score update.
    return rows.map((row: any, index) => ({
      ...row,
      rank: index + 1,
      rankChange: row.previousRank ? Number(row.previousRank) - (index + 1) : 0,
    }));
  }

  async me(userId: string) {
    const doc = await this.firestore.db.collection(this.users).doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async fixture(fixtureId: number, limit = 100) {
    const safeLimit = this.safeLimit(limit);
    // Scoring writes one match-score document for every saved fantasy team.
    // Read only those score documents; do not re-scan fantasyTeams or profiles
    // every time a user opens/refreshes the leaderboard.
    const snap = await this.firestore.db.collection(this.matchScores)
      .where('fixtureId', '==', fixtureId)
      .get();

    const rows = snap.docs.map((doc) => {
      const row = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        userId: String(row.userId),
        fixtureId,
        format: row.format ?? null,
        points: Number(row.points) || 0,
        hasScore: true,
        displayName: row.displayName ?? 'CrickX Player',
        avatarUrl: row.avatarUrl ?? null,
      };
    })
      .sort((a, b) => Number(b.points) - Number(a.points) || a.userId.localeCompare(b.userId))
      .slice(0, safeLimit);

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }

  async contest(contestId: string, limit = 100) {
    const safeLimit = this.safeLimit(limit);
    // Rank contest entries in application code so the endpoint does not depend
    // on a Firestore composite index being present in the target project.
    const snap = await this.firestore.db.collection('contestEntries')
      .where('contestId', '==', contestId)
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
