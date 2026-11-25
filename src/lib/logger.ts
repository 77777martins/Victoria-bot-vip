import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['token', '*.token', 'BOT_TOKEN', 'DATABASE_URL', '*.secret', 'headers.authorization'],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
});
