import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// FRONTEND_URL can hold one or more comma-separated origins (production
// domain, local dev server, etc.) — this avoids needing to redeploy or
// toggle env vars just to test the frontend locally against this backend.
function buildCorsOrigin() {
  const raw = process.env.FRONTEND_URL;
  if (!raw) return '*';

  const allowed = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (allowed.length === 0) return '*';

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No Origin header (curl, server-to-server, Postman) — allow.
    if (!origin) return callback(null, true);
    callback(null, allowed.includes(origin));
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: buildCorsOrigin() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Nexus backend listening on :${port}`);
}
bootstrap();
