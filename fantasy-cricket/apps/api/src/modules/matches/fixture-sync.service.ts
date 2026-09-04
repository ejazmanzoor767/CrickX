import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchesService } from './matches.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';

/**
 * Pre-warms the Sportmonks fixture cache for upcoming matches so the
 * fantasy team-builder and match-detail screens load instantly instead of
 * making users wait on a live Sportmonks round-trip. Purely a performance
 * optimization on top of real data — never fabricates anything; if
 * Sportmonks has nothing to return, nothing is cached.
 */
@Injectable()
export class FixtureSyncService {
  private readonly logger = new Logger(FixtureSyncService.name);

  constructor(
    private readonly matches: MatchesService,
    private readonly sportmonks: SportmonksDataService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncUpcoming() {
    try {
      const { data: fixtures } = await this.matches.listUpcomingAndRecent(1);
      const soon = fixtures.filter((f) => {
        const startsInMs = new Date(f.starting_at).getTime() - Date.now();
        return startsInMs > 0 && startsInMs < 24 * 60 * 60 * 1000; // within next 24h
      });

      for (const f of soon) {
        await this.sportmonks.getFixture(f.id); // populates/refreshes CachedFixture
      }
      this.logger.debug(`Pre-warmed cache for ${soon.length} fixtures starting within 24h.`);
    } catch (err) {
      this.logger.error('Fixture sync failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
