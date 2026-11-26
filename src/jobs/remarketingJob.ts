import type { Telegram } from 'telegraf';
import { logger } from '../lib/logger';
import { escapeHtml } from '../lib/format';
import { keyboards } from '../bot/keyboards';
import { isBlockedError, sendMediaMessage, sleep } from '../bot/mediaSender';
import { remarketingService } from '../services/remarketingService';

const INTERVAL_MS = 10 * 60 * 1000;
const BATCH_PER_STEP = 200;
const SEND_GAP_MS = 60; // bem abaixo do limite de ~30 msg/s do Telegram

/**
 * Envia a sequência de remarketing para quem não comprou.
 * Percorre do último passo para o primeiro: quem está atrasado recebe só
 * o passo mais recente devido (evita rajada de mensagens).
 */
export const startRemarketingJob = (telegram: Telegram): (() => void) => {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const steps = await remarketingService.listSteps();
      for (let index = steps.length - 1; index >= 0; index--) {
        const step = steps[index]!;
        const users = await remarketingService.findDueUsers(index, step.delayHours, BATCH_PER_STEP);

        for (const user of users) {
          const telegramId = Number(user.telegramId);
          try {
            await sendMediaMessage(
              telegram,
              telegramId,
              { ...step, text: escapeHtml(step.text) },
              { parseMode: 'HTML', replyMarkup: keyboards.remarketing().reply_markup },
            );
          } catch (err) {
            if (isBlockedError(err)) await remarketingService.optOut(user.id);
            else logger.warn({ err, telegramId }, 'remarketing não entregue');
          }
          // Avança mesmo em falha para não reenviar o mesmo passo em loop
          await remarketingService.advance(user.id, index + 1);
          await sleep(SEND_GAP_MS);
        }
        if (users.length) logger.info({ step: index + 1, sent: users.length }, 'remarketing enviado');
      }
    } catch (err) {
      logger.error({ err }, 'erro no job de remarketing');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void run(), INTERVAL_MS);
  return () => clearInterval(timer);
};
