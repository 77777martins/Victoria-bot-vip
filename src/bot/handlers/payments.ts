import type { Telegraf } from 'telegraf';
import type { BotContext } from '../context';
import { messages } from '../messages';
import { paymentService } from '../../services/paymentService';
import { logger } from '../../lib/logger';

export const registerPaymentHandlers = (bot: Telegraf<BotContext>): void => {
  // O Telegram exige resposta em até 10s, senão cancela a compra.
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery;
    try {
      const result = await paymentService.validatePreCheckout({
        payload: q.invoice_payload,
        telegramId: q.from.id,
        amount: q.total_amount,
        currency: q.currency,
      });
      if (result.ok) await ctx.answerPreCheckoutQuery(true);
      else await ctx.answerPreCheckoutQuery(false, result.reason);
    } catch (err) {
      logger.error({ err }, 'erro no pre_checkout');
      await ctx.answerPreCheckoutQuery(false, 'Erro temporário. Tente novamente.');
    }
  });

  bot.on('successful_payment', async (ctx) => {
    const sp = ctx.message.successful_payment;
    const telegramId = ctx.from.id;

    const { alreadyProcessed, subscription } = await paymentService.confirm({
      payload: sp.invoice_payload,
      providerChargeId: sp.telegram_payment_charge_id,
      amount: sp.total_amount,
      currency: sp.currency,
    });

    if (alreadyProcessed || !subscription) {
      logger.info({ telegramId }, 'successful_payment duplicado ignorado');
      return;
    }

    logger.info({ telegramId, subscriptionId: subscription.id }, 'pagamento confirmado');
    const link = await ctx.access.createInviteLink(telegramId);
    await ctx.reply(messages.paymentApproved(link, subscription.expiresAt), { parse_mode: 'HTML' });
  });
};
