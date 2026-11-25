import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { ALLOWED_UPDATES, createBot } from './bot';
import { startExpirationJob } from './jobs/expirationJob';

async function main(): Promise<void> {
  await prisma.$connect();
  const { bot, access } = createBot();

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Início' },
    { command: 'planos', description: 'Ver planos VIP' },
    { command: 'assinatura', description: 'Minha assinatura' },
    { command: 'termos', description: 'Termos de uso' },
    { command: 'paysupport', description: 'Suporte de pagamento' },
  ]);

  const stopJob = startExpirationJob(bot.telegram, access);

  const launchOptions = env.WEBHOOK_DOMAIN
    ? {
        allowedUpdates: [...ALLOWED_UPDATES],
        webhook: { domain: env.WEBHOOK_DOMAIN, port: env.PORT, secretToken: env.WEBHOOK_SECRET },
      }
    : { allowedUpdates: [...ALLOWED_UPDATES], dropPendingUpdates: false };

  // launch() só resolve quando o bot para (polling) — não aguardar aqui.
  bot.launch(launchOptions).catch((err: unknown) => {
    logger.fatal({ err }, 'falha ao iniciar o bot');
    process.exit(1);
  });
  logger.info({ mode: env.WEBHOOK_DOMAIN ? 'webhook' : 'polling' }, 'bot iniciado');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'encerrando');
    stopJob();
    bot.stop(signal);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'erro fatal na inicialização');
  process.exit(1);
});
