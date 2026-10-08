import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        message: 'Internal server error.',
      });
      return;
    }

    const raw = exception instanceof HttpException ? exception.getResponse() : 'Request failed.';
    const message = typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'message' in raw
        ? (raw as { message: unknown }).message
        : 'Request failed.';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
