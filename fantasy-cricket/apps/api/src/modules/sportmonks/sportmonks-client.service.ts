import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { SportmonksEnvelope } from './sportmonks.types';

/**
 * SportmonksClientService
 *
 * The ONLY place in the codebase allowed to call cricket.sportmonks.com.
 * Every other module (matches, fantasy, scoring) must go through
 * SportmonksDataService, which in turn uses this client.
 *
 * Responsibilities:
 *  - Attach api_token
 *  - Enforce the plan's hourly rate limit (3,000 req/hr on all cricket
 *    plans per Sportmonks docs) with a local token-bucket so we fail fast
 *    instead of hammering the API into a 429.
 *  - Normalize 400/401/403/404/429/500 into typed exceptions the rest of
 *    the app can handle distinctly (e.g. 403 = plan doesn't cover this
 *    league; surface that clearly instead of a generic 500).
 *  - Retry transient failures (429/5xx) with backoff.
 */
@Injectable()
export class SportmonksClientService {
  private readonly logger = new Logger(SportmonksClientService.name);
  private readonly http: AxiosInstance;

  // Local rate budget mirroring the plan limit; refilled hourly.
  private requestsThisWindow = 0;
  private windowStartedAt = Date.now();
  private readonly HOURLY_LIMIT: number;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>('SPORTMONKS_BASE_URL', 'https://cricket.sportmonks.com/api/v2.0');
    const apiToken = this.config.get<string>('SPORTMONKS_API_TOKEN');
    this.HOURLY_LIMIT = this.config.get<number>('SPORTMONKS_HOURLY_LIMIT', 3000);

    if (!apiToken) {
      throw new Error('SPORTMONKS_API_TOKEN is not set — set it in your environment before starting the API.');
    }

    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      params: { api_token: apiToken },
    });
  }

  private resetWindowIfNeeded() {
    const elapsed = Date.now() - this.windowStartedAt;
    if (elapsed > 60 * 60 * 1000) {
      this.windowStartedAt = Date.now();
      this.requestsThisWindow = 0;
    }
  }

  private assertBudget() {
    this.resetWindowIfNeeded();
    if (this.requestsThisWindow >= this.HOURLY_LIMIT) {
      throw new HttpException(
        'Sportmonks hourly request budget exhausted for this application instance. Try again next window.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * GET against the Sportmonks Cricket API.
   * `path` is relative, e.g. "/fixtures", "/fixtures/3", "/players/search/Kohli".
   */
  async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    attempt = 1,
  ): Promise<SportmonksEnvelope<T>> {
    this.assertBudget();

    try {
      this.requestsThisWindow += 1;
      const response = await this.http.get<SportmonksEnvelope<T>>(path, { params });
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const status = axiosErr.response?.status;

      if (status === 429 && attempt <= 3) {
        const backoffMs = 500 * attempt * attempt;
        this.logger.warn(`Sportmonks 429 on ${path}, retrying in ${backoffMs}ms (attempt ${attempt})`);
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.get<T>(path, params, attempt + 1);
      }

      if (status && status >= 500 && attempt <= 2) {
        const backoffMs = 500 * attempt;
        this.logger.warn(`Sportmonks ${status} on ${path}, retrying in ${backoffMs}ms`);
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.get<T>(path, params, attempt + 1);
      }

      if (status === 403) {
        throw new HttpException(
          `Sportmonks plan does not cover this resource (${path}). Check league/competition coverage for your subscription.`,
          HttpStatus.FORBIDDEN,
        );
      }
      if (status === 404) {
        throw new HttpException(`Sportmonks resource not found (${path}) — it may have been rescheduled or removed.`, HttpStatus.NOT_FOUND);
      }
      if (status === 401) {
        throw new HttpException('Sportmonks API token is invalid or missing.', HttpStatus.UNAUTHORIZED);
      }

      this.logger.error(`Sportmonks request failed: ${path}`, axiosErr.message);
      throw new HttpException('Upstream cricket data provider error.', HttpStatus.BAD_GATEWAY);
    }
  }
}
