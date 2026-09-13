import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // `rawBody: true` makes Nest's body parser stash the exact raw bytes on
  // req.rawBody for every request, which RazorpayWebhookController needs
  // for HMAC signature verification (Razorpay signs the raw JSON body).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Keep CORS explicit and credential-safe. The frontend sends Firebase auth
  // tokens in the Authorization header, and browsers reject `*` together
  // with `credentials: true`.
  // Reflect the browser origin for CORS. This avoids preflight failures from
  // stale/misconfigured origin allowlists while keeping credentials enabled.
  const configuredOrigins = (process.env.CORS_ORIGIN || 'https://crickx-3d806.web.app')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedHeaders = 'Content-Type, Authorization, Accept, Origin, X-Requested-With';
  const allowedMethods = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

  // Handle browser preflight explicitly before Nest routes/guards. This makes
  // Firebase -> Render OPTIONS requests succeed even when no controller matches
  // the target URL yet.
  app.use((req: any, res: any, next: any) => {
    const requestOrigin = req.headers?.origin;
    if (requestOrigin) {
      const allowed = configuredOrigins.includes(requestOrigin) || requestOrigin.endsWith('.web.app');
      if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', allowedMethods);
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
      }
    }
    if (req.method === 'OPTIONS') {
      if (requestOrigin && (configuredOrigins.includes(requestOrigin) || requestOrigin.endsWith('.web.app'))) {
        return res.status(204).end();
      }
    }
    next();
  });

  app.enableCors({
    origin: true,
    credentials: true,
    methods: allowedMethods,
    allowedHeaders,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Fantasy Cricket API listening on :${port}`);
}
bootstrap();
