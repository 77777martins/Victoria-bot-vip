import type { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import type { BotContext } from '../context';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { keyboards } from '../keyboards';
import { messages } from '../messages';
import { pixService } from '../../services/pixService';

const ACCEPTED_DOC_MIME = /^(image\/|application\/pdf$)/;

/**
 * Comprovante de PIX: foto ou arquivo (imagem/PDF) enviado pelo cliente
 * que tem cobrança PIX aguardando. Sem cobrança pendente, segue o fluxo normal
 * (ex.: admin enviando mídia para configurar o bot).
 */
export const registerPixProofHandler = (bot: Telegraf<BotContext>): void => {
  const handleProof = async (ctx: BotContext, fileId: string, kind: 'photo' | 'document', next: () => Promise<void>) => {
    if (ctx.chat?.type !== 'private' || !ctx.appUser || !ctx.from) return next();

    const payment = await pixService.findAwaitingProof(ctx.appUser.id);
    if (!payment) return next();
    if (!(await pixService.attachProof(payment.id, fileId))) return next();

    await ctx.reply(messages.pixProofReceived, { parse_mode: 'HTML' });

    const caption = messages.pixReviewAdmin({
      buyer: ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name,
      telegramId: ctx.from.id,
      planName: payment.plan.name,
      amountCents: payment.amount,
      txid: payment.pixTxid,
      createdAt: payment.createdAt,
    });
    const extra = { caption, parse_mode: 'HTML' as const, ...keyboards.pixReview(payment.id) };

    await Promise.all(
      [...env.ADMIN_IDS].map((adminId) =>
        (kind === 'photo'
          ? ctx.telegram.sendPhoto(adminId, fileId, extra)
          : ctx.telegram.sendDocument(adminId, fileId, extra)
        ).catch((err: unknown) => logger.warn({ err, adminId }, 'comprovante PIX não entregue ao admin')),
      ),
    );
    logger.info({ paymentId: payment.id }, 'comprovante PIX recebido');
  };

  bot.on(message('photo'), (ctx, next) => {
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    return largest ? handleProof(ctx, largest.file_id, 'photo', next) : next();
  });

  bot.on(message('document'), (ctx, next) => {
    const doc = ctx.message.document;
    if (!doc.mime_type || !ACCEPTED_DOC_MIME.test(doc.mime_type)) return next();
    return handleProof(ctx, doc.file_id, 'document', next);
  });
};
