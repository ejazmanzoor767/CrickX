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
  const configuredOrigins = String(process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    'https://crickx-3d806.web.app',
    'https://crickx-3d806.firebaseapp.com',
    'http://localhost:3000',
    ...configuredOrigins.filter((origin) => origin !== '*'),
  ]);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${requestOrigin}`));
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Fantasy Cricket API listening on :${port}`);
}
bootstrap();
