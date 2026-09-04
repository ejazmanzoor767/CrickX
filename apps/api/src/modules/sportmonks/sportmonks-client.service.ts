import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { SportmonksEnvelope } from './sportmonks.types';

@Injectable()
export class SportmonksClientService {
  private readonly logger = new Logger(SportmonksClientService.name);
  private readonly http: AxiosInstance;
  private requestsThisWindow = 0;
  private windowStartedAt = Date.now();
  private readonly HOURLY_LIMIT: number;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>('SPORTMONKS_BASE_URL', 'https://cricket.sportmonks.com/api/v2.0');
    const apiToken = this.config.get<string>('SPORTMONKS_API_TOKEN');
    this.HOURLY_LIMIT = Number(this.config.get<string>('SPORTMONKS_HOURLY_LIMIT', '3000'));

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
    if (Date.now() - this.windowStartedAt > 60 * 60 * 1000) {
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

  private describeProviderError(data: unknown, fallback: string) {
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      const body = data as Record<string, unknown>;
      if (typeof body.message === 'string' && body.message.trim()) return body.message;
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
      try {
        return JSON.stringify(body);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

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
      const axiosErr = err as AxiosError<unknown>;
      const status = axiosErr.response?.status;
      const providerMessage = this.describeProviderError(axiosErr.response?.data, axiosErr.message);

      if (status === 429 && attempt <= 3) {
        const backoffMs = 500 * attempt * attempt;
        this.logger.warn(`Sportmonks 429 on ${path}, retrying in ${backoffMs}ms (attempt ${attempt})`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.get<T>(path, params, attempt + 1);
      }

      if (status && status >= 500 && attempt <= 2) {
        const backoffMs = 500 * attempt;
        this.logger.warn(`Sportmonks ${status} on ${path}, retrying in ${backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.get<T>(path, params, attempt + 1);
      }

      if (status === 400) {
        this.logger.error(`Sportmonks 400 on ${path}: ${providerMessage}`);
        throw new HttpException(`Sportmonks rejected ${path}: ${providerMessage}`, HttpStatus.BAD_REQUEST);
      }
      if (status === 401) {
        throw new HttpException('Sportmonks API token is invalid or missing.', HttpStatus.UNAUTHORIZED);
      }
      if (status === 403) {
        throw new HttpException(
          `Sportmonks plan does not cover this resource (${path}). Check league/competition coverage for your subscription.`,
          HttpStatus.FORBIDDEN,
        );
      }
      if (status === 404) {
        throw new HttpException(`Sportmonks resource not found (${path}).`, HttpStatus.NOT_FOUND);
      }
      if (status === 429) {
        throw new HttpException('Sportmonks rate limit reached. Please retry shortly.', HttpStatus.TOO_MANY_REQUESTS);
      }

      this.logger.error(`Sportmonks request failed: ${path}`, providerMessage);
      throw new HttpException(`Upstream cricket data provider error: ${providerMessage}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
