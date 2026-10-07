import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import express from 'express';

function allowedOrigins() {
  const configured = String(process.env.CRICKX_ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  const web = String(process.env.CRICKX_WEB_URL || 'https://crickxfantasy.site').trim().replace(/\/$/, '');
  return [...new Set([web, 'https://crickx-3d806.web.app', 'https://crickx-3d806.firebaseapp.com', ...configured])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: false });
  const server = app.getHttpAdapter().getInstance();
  server.use(express.json({
    limit: '1.5mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));
  server.use(express.urlencoded({ extended: true, limit: '1.5mb' }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  }));
  app.useGlobalFilters(new HttpExceptionFilter());

  server.set('trust proxy', 1);

  const origins = new Set(allowedOrigins());
  const allowedHeaders = 'Content-Type, Authorization, Accept, Origin, X-Requested-With';
  const allowedMethods = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

  app.use((req: any, res: any, next: any) => {
    const origin = String(req.headers?.origin || '');
    if (origin && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', allowedMethods);
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
      res.setHeader('Access-Control-Max-Age', '600');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    if (req.method === 'OPTIONS') {
      if (!origin || !origins.has(origin)) return res.status(403).end();
      return res.status(204).end();
    }

    next();
  });

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Fantasy Cricket API listening on :${port}`);
}
bootstrap();
