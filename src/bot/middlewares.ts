import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from './context';
import { userService } from '../services/userService';
import { messages } from './messages';
import { CB, keyboards } from './keyboards';

/** Updates de pagamento/entrada NUNCA podem ser descartados. */
const isCriticalUpdate = (ctx: BotContext): boolean =>
  'pre_checkout_query' in ctx.update ||
  'chat_join_request' in ctx.update ||
  (ctx.message !== undefined && 'successful_payment' in ctx.message);

/** Rate limit simples em memória (instância única). */
export const rateLimit = (opts = { windowMs: 10_000, max: 15 }): MiddlewareFn<BotContext> => {
  const hits = new Map<number, number[]>();

  setInterval(() => {
    const cutoff = Date.now() - opts.windowMs;
    for (const [id, times] of hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) hits.set(id, recent);
      else hits.delete(id);
    }
  }, 60_000).unref();

  return async (ctx, next) => {
    const id = ctx.from?.id;
    if (!id || isCriticalUpdate(ctx)) return next();

    const now = Date.now();
    const recent = (hits.get(id) ?? []).filter((t) => t > now - opts.windowMs);
    recent.push(now);
    hits.set(id, recent);

    if (recent.length > opts.max) {
      if (recent.length === opts.max + 1 && ctx.chat?.type === 'private') {
        await ctx.reply(messages.rateLimited).catch(() => undefined);
      }
      if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => undefined);
      return;
    }
    return next();
  };
};

/** Carrega/cria o usuário em chats privados e bloqueia banidos. */
export const ensureUser: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (ctx.chat?.type !== 'private' || !ctx.from || ctx.from.is_bot) return next();

  const user = await userService.upsertFromTelegram(ctx.from);
  ctx.appUser = user;

  if (user.isBanned && !isCriticalUpdate(ctx)) {
    if (ctx.callbackQuery) await ctx.answerCbQuery();
    await ctx.reply(messages.banned);
    return;
  }
  return next();
};

const OPEN_COMMANDS = new Set(['/start', '/termos', '/paysupport']);
const OPEN_CALLBACKS = new Set<string>([CB.ageAccept, CB.ageDecline]);

/** Exige confirmação de 18+ antes de qualquer ação de compra. */
export const requireAge: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (ctx.chat?.type !== 'private' || !ctx.appUser || isCriticalUpdate(ctx)) return next();
  if (ctx.appUser.ageConfirmedAt) return next();

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const command = text.startsWith('/') ? text.split(/[\s@]/)[0] : undefined;
  if (command && OPEN_COMMANDS.has(command)) return next();

  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (data && OPEN_CALLBACKS.has(data)) return next();

  if (ctx.callbackQuery) await ctx.answerCbQuery();
  await ctx.reply(messages.ageGate(ctx.appUser.firstName), { parse_mode: 'HTML', ...keyboards.ageGate() });
};

/**
 * Comandos colados com formatação (ex.: monoespaçado/código) chegam sem a
 * entidade bot_command e o Telegraf não os reconhece. Em chat privado,
 * se a mensagem começa com "/comando", recria a entidade no início.
 */
export const normalizePastedCommand: MiddlewareFn<BotContext> = (ctx, next) => {
  const msg = ctx.message;
  if (ctx.chat?.type !== 'private' || !msg || !('text' in msg)) return next();

  const match = /^\/[A-Za-z0-9_]{1,32}(@[A-Za-z0-9_]{5,32})?/.exec(msg.text);
  const first = msg.entities?.[0];
  if (!match || (first?.type === 'bot_command' && first.offset === 0)) return next();

  const commandEntity = { type: 'bot_command' as const, offset: 0, length: match[0].length };
  // Remove formatações que se sobrepõem ao comando e mantém o resto
  const others = (msg.entities ?? []).filter((e) => e.offset >= match[0].length);
  (msg as { entities?: unknown[] }).entities = [commandEntity, ...others];
  return next();
};
