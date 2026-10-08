import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchesService } from './matches.service';
import { SportmonksDataService } from '../sportmonks/sportmonks-data.service';
import { SportmonksFixture } from '../sportmonks/sportmonks.types';

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


  /**
   * Re-check active live fixtures directly against Sportmonks every 30 seconds.
   * This keeps the Live -> Completed transition working even when no browser
   * is currently polling the match-centre page.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async syncLiveCompletion() {
    try {
      const completed = await this.matches.syncLiveProjection();
      if (completed.length > 0) {
        this.logger.log(`Projected ${completed.length} newly completed fixture(s): ${completed.join(', ')}`);
      }
    } catch (err) {
      this.logger.error('Live completion sync failed', err instanceof Error ? err.stack : String(err));
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncUpcoming() {
    try {
      const { data: fixtures } = await this.matches.listUpcomingAndRecent(1);
      const soon = fixtures.filter((f: SportmonksFixture) => {
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
