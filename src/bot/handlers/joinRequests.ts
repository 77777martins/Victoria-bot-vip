import type { Telegraf } from 'telegraf';
import type { BotContext } from '../context';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { userService } from '../../services/userService';
import { subscriptionService } from '../../services/subscriptionService';

/**
 * Só aprova a entrada no grupo de quem tem assinatura ativa.
 * Isso torna inútil compartilhar o link de convite.
 */
export const registerJoinRequestHandler = (bot: Telegraf<BotContext>): void => {
  bot.on('chat_join_request', async (ctx) => {
    const req = ctx.chatJoinRequest;
    if (req.chat.id !== env.GROUP_CHAT_ID) return;

    const telegramId = req.from.id;
    const user = await userService.findByTelegramId(telegramId);
    const active = user && !user.isBanned ? await subscriptionService.getActive(user.id) : null;

    if (active) {
      await ctx.access.approveJoin(telegramId);
      logger.info({ telegramId }, 'entrada aprovada');
    } else {
      await ctx.access.declineJoin(telegramId);
      logger.warn({ telegramId }, 'entrada recusada (sem assinatura ativa)');
    }
  });
};
