import type { Telegraf } from 'telegraf';
import type { BotContext } from '../context';
import { CB, keyboards } from '../keyboards';
import { messages } from '../messages';
import { planService } from '../../services/planService';
import { paymentService, STARS_CURRENCY } from '../../services/paymentService';
import { subscriptionService } from '../../services/subscriptionService';
import { DomainError } from '../../domain/types';
import { sendPlans } from '../presenters';

const SLUG_RE = /^buy:([a-z0-9-]{1,32})$/;

export const registerPlanHandlers = (bot: Telegraf<BotContext>): void => {
  const showPlans = (ctx: BotContext) => sendPlans(ctx);

  bot.command('planos', showPlans);
  bot.action(CB.plans, async (ctx) => {
    await ctx.answerCbQuery();
    await showPlans(ctx);
  });

  bot.action(SLUG_RE, async (ctx) => {
    await ctx.answerCbQuery();
    const user = ctx.appUser;
    const slug = ctx.match[1];
    if (!user || !slug) return;

    const plan = await planService.findActiveBySlug(slug);
    if (!plan) {
      await ctx.reply('Plano indisponível. Veja /planos.');
      return;
    }

    try {
      const payment = await paymentService.createPending(user.id, plan);
      await ctx.replyWithInvoice({
        title: messages.invoiceTitle(plan),
        description: messages.invoiceDescription(plan),
        payload: payment.invoicePayload,
        provider_token: '', // vazio para Telegram Stars
        currency: STARS_CURRENCY,
        prices: [{ label: plan.name, amount: plan.priceStars }],
      });
    } catch (err) {
      if (err instanceof DomainError) {
        await ctx.reply(err.message);
        return;
      }
      throw err;
    }
  });

  const showStatus = async (ctx: BotContext) => {
    if (!ctx.appUser) return;
    const sub = await subscriptionService.getActive(ctx.appUser.id);
    if (!sub) {
      await ctx.reply(messages.noSubscription, keyboards.renew());
      return;
    }
    const plan = await planService.findById(sub.planId);
    const planName = plan?.name ?? 'VIP';
    await ctx.reply(messages.status(planName, sub.expiresAt), { parse_mode: 'HTML' });
  };

  bot.command('assinatura', showStatus);
  bot.action(CB.status, async (ctx) => {
    await ctx.answerCbQuery();
    await showStatus(ctx);
  });
};
