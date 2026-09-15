import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Firebase uses a Bearer Authorization header, not cookies. Keep one simple
  // CORS middleware so preflight is answered before guards/controllers.
  const allowedHeaders = 'Content-Type, Authorization, Accept, Origin, X-Requested-With';
  const allowedMethods = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

  app.use((req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', allowedMethods);
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

    if (req.method === 'OPTIONS') {
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
