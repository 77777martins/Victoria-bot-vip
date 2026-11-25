import { Telegraf } from 'telegraf';
import type { BotContext } from './context';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { createAccessService } from '../services/accessService';
import { ensureUser, rateLimit, requireAge } from './middlewares';
import { messages } from './messages';
import { registerStartHandlers } from './handlers/start';
import { registerPlanHandlers } from './handlers/plans';
import { registerPaymentHandlers } from './handlers/payments';
import { registerJoinRequestHandler } from './handlers/joinRequests';
import { registerAdminHandlers } from './handlers/admin';

export const ALLOWED_UPDATES = ['message', 'callback_query', 'pre_checkout_query', 'chat_join_request'] as const;

export const createBot = () => {
  const bot = new Telegraf<BotContext>(env.BOT_TOKEN, { handlerTimeout: 30_000 });
  const access = createAccessService(bot.telegram);

  bot.use((ctx, next) => {
    ctx.access = access;
    return next();
  });
  bot.use(rateLimit());
  bot.use(ensureUser);

  // Pagamento e entrada no grupo antes do age gate (nunca bloquear esses updates)
  registerPaymentHandlers(bot);
  registerJoinRequestHandler(bot);
  registerAdminHandlers(bot);

  bot.use(requireAge);
  registerStartHandlers(bot);
  registerPlanHandlers(bot);

  bot.catch(async (err, ctx) => {
    logger.error({ err, updateType: ctx.updateType, userId: ctx.from?.id }, 'erro não tratado');
    if (ctx.chat?.type === 'private') await ctx.reply(messages.genericError).catch(() => undefined);
  });

  return { bot, access };
};
