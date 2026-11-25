import type { Telegram } from 'telegraf';
import { logger } from '../lib/logger';
import { messages } from '../bot/messages';
import { keyboards } from '../bot/keyboards';
import { subscriptionService } from '../services/subscriptionService';
import type { AccessService } from '../services/accessService';

const INTERVAL_MS = 5 * 60 * 1000;

/**
 * Avisa quem vence em 24h e remove do grupo quem expirou.
 * Pensado para UMA instância do bot (ver README).
 */
export const startExpirationJob = (telegram: Telegram, access: AccessService): (() => void) => {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      for (const sub of await subscriptionService.findExpiringSoon()) {
        const telegramId = Number(sub.user.telegramId);
        await telegram
          .sendMessage(telegramId, messages.expiringSoon(sub.expiresAt!), { parse_mode: 'HTML', ...keyboards.renew() })
          .catch((err: unknown) => logger.warn({ err, telegramId }, 'aviso de vencimento não entregue'));
        await subscriptionService.markNotified(sub.id);
      }

      for (const sub of await subscriptionService.findExpired()) {
        if (!(await subscriptionService.markExpired(sub.id))) continue;

        // Renovou nesse meio tempo? Mantém no grupo.
        if (await subscriptionService.getActive(sub.userId)) continue;

        const telegramId = Number(sub.user.telegramId);
        await access.kick(telegramId).catch((err: unknown) => logger.warn({ err, telegramId }, 'kick falhou'));
        await telegram
          .sendMessage(telegramId, messages.expired, keyboards.renew())
          .catch(() => undefined);
        logger.info({ telegramId }, 'assinatura expirada removida');
      }
    } catch (err) {
      logger.error({ err }, 'erro no job de expiração');
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), INTERVAL_MS);
  return () => clearInterval(timer);
};
