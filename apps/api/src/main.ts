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
  // Firebase uses a Bearer Authorization header, so cookies are not needed.
  // Normalize the configured production origin to avoid a trailing-slash mismatch.
  let frontendOrigin = (process.env.CORS_ORIGIN || 'https://crickx-3d806.web.app').trim();
  if (frontendOrigin.endsWith('/')) frontendOrigin = frontendOrigin.slice(0, -1);
  const allowedHeaders = 'Content-Type, Authorization, Accept, Origin, X-Requested-With';
  const allowedMethods = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

  // Handle CORS ourselves. This runs before Nest routes/guards and does not
  // depend on the cors package accepting the configured origin.
  app.use((req: any, res: any, next: any) => {
    const origin = String(req.headers?.origin || '');
    if (origin === frontendOrigin) {
      res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', allowedMethods);
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    }

    if (req.method === 'OPTIONS' && origin === frontendOrigin) {
      return res.status(204).end();
    }

    next();
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Fantasy Cricket API listening on :${port}`);
}
bootstrap();
