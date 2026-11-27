import { Composer } from 'telegraf';
import type { BotContext } from '../../context';
import { logger } from '../../../lib/logger';
import { formatDate } from '../../../lib/format';
import { messages } from '../../messages';
import { pixService } from '../../../services/pixService';
import { audit } from './utils';

/** Aprovação/recusa de PIX manual pelos botões enviados aos admins. */
export const pixAdmin = new Composer<BotContext>();

const UUID = '([0-9a-f-]{36})';
const APPROVE_RE = new RegExp(`^pix:ok:${UUID}$`);
const REJECT_RE = new RegExp(`^pix:no:${UUID}$`);

/** Atualiza a legenda do comprovante com o resultado e remove os botões. */
const markReviewed = async (ctx: BotContext, label: string) => {
  const msg = ctx.callbackQuery?.message;
  const original = msg && 'caption' in msg ? (msg.caption ?? '') : '';
  const who = ctx.from?.first_name ?? 'admin';
  await ctx
    .editMessageCaption(`${original}\n\n${label} por ${who} em ${formatDate(new Date())}`, { reply_markup: undefined })
    .catch(() => ctx.editMessageReplyMarkup(undefined).catch(() => undefined));
};

const alreadyReviewed = (ctx: BotContext) => ctx.answerCbQuery('Esse PIX já foi analisado.', { show_alert: true });

pixAdmin.action(APPROVE_RE, async (ctx) => {
  const paymentId = ctx.match[1]!;
  const result = await pixService.approve(paymentId, ctx.from!.id);
  if (!result.ok) {
    await alreadyReviewed(ctx);
    return markReviewed(ctx, 'ℹ️ Já analisado');
  }

  await ctx.answerCbQuery('Aprovado! Liberando acesso…');
  audit(ctx, 'pix:aprovar', { paymentId });
  await markReviewed(ctx, '✅ APROVADO');

  try {
    const link = await ctx.access.createInviteLink(result.telegramId);
    await ctx.telegram.sendMessage(
      result.telegramId,
      messages.paymentApproved(link, result.subscription?.expiresAt ?? null),
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    // Acesso já está ativo no banco: o cliente pode pedir o link de novo pelo suporte
    logger.error({ err, paymentId }, 'PIX aprovado mas falhou ao enviar link');
    await ctx.reply('⚠️ Aprovado, mas não consegui enviar o link ao cliente. Use /liberar se precisar reenviar.');
  }
});

pixAdmin.action(REJECT_RE, async (ctx) => {
  const paymentId = ctx.match[1]!;
  const result = await pixService.reject(paymentId, ctx.from!.id);
  if (!result.ok) {
    await alreadyReviewed(ctx);
    return markReviewed(ctx, 'ℹ️ Já analisado');
  }

  await ctx.answerCbQuery('Recusado.');
  audit(ctx, 'pix:recusar', { paymentId });
  await markReviewed(ctx, '❌ RECUSADO');
  await ctx.telegram
    .sendMessage(result.telegramId, messages.pixRejected)
    .catch((err: unknown) => logger.warn({ err, paymentId }, 'aviso de recusa não entregue'));
});

pixAdmin.command('pixpendentes', async (ctx) => {
  const count = await pixService.countAwaitingReview();
  return ctx.reply(count ? `💠 ${count} comprovante(s) aguardando sua análise (veja as mensagens acima).` : '✅ Nenhum PIX pendente.');
});
