import type { Telegraf } from 'telegraf';
import type { BotContext } from '../context';
import { CB, keyboards } from '../keyboards';
import { messages } from '../messages';
import { planService } from '../../services/planService';
import { paymentService, STARS_CURRENCY } from '../../services/paymentService';
import { subscriptionService } from '../../services/subscriptionService';
import QRCode from 'qrcode';
import { DomainError, type PlanDTO } from '../../domain/types';
import { isPixEnabled, pixService } from '../../services/pixService';
import { sendPlans } from '../presenters';

const BUY_RE = /^buy:([a-z0-9-]{1,32})$/;
const PAY_STARS_RE = /^pay:stars:([a-z0-9-]{1,32})$/;
const PAY_PIX_RE = /^pay:pix:([a-z0-9-]{1,32})$/;

/** Executa a ação e mostra erros de regra de negócio ao usuário. */
const withDomainErrors = async (ctx: BotContext, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (err) {
    if (err instanceof DomainError) {
      await ctx.reply(err.message);
      return;
    }
    throw err;
  }
};

const sendStarsInvoice = async (ctx: BotContext, userId: string, plan: PlanDTO) => {
  const payment = await paymentService.createPending(userId, plan);
  await ctx.replyWithInvoice({
    title: messages.invoiceTitle(plan),
    description: messages.invoiceDescription(plan),
    payload: payment.invoicePayload,
    provider_token: '', // vazio para Telegram Stars
    currency: STARS_CURRENCY,
    prices: [{ label: plan.name, amount: plan.priceStars }],
  });
};

const sendPixCharge = async (ctx: BotContext, userId: string, plan: PlanDTO) => {
  const { copyPaste } = await pixService.createCharge(userId, plan);
  const qr = await QRCode.toBuffer(copyPaste, { type: 'png', width: 512, margin: 2, errorCorrectionLevel: 'M' });
  await ctx.replyWithPhoto({ source: qr }, { caption: messages.pixCharge(plan), parse_mode: 'HTML' });
  await ctx.reply(messages.pixCopyPaste(copyPaste), { parse_mode: 'HTML' });
};

export const registerPlanHandlers = (bot: Telegraf<BotContext>): void => {
  const showPlans = (ctx: BotContext) => sendPlans(ctx);

  bot.command('planos', showPlans);
  bot.action(CB.plans, async (ctx) => {
    await ctx.answerCbQuery();
    await showPlans(ctx);
  });

  /** Resolve usuário + plano a partir do slug do callback. */
  const resolve = async (ctx: BotContext, slug: string | undefined) => {
    await ctx.answerCbQuery();
    if (!ctx.appUser || !slug) return null;
    const plan = await planService.findActiveBySlug(slug);
    if (!plan) {
      await ctx.reply('Plano indisponível. Veja /planos.');
      return null;
    }
    return { userId: ctx.appUser.id, plan };
  };

  // Escolheu o plano: com PIX ativo pergunta o método; senão vai direto para Stars
  bot.action(BUY_RE, async (ctx) => {
    const r = await resolve(ctx, ctx.match[1]);
    if (!r) return;
    if (isPixEnabled()) {
      await ctx.reply(messages.paymentMethod(r.plan), { parse_mode: 'HTML', ...keyboards.paymentMethod(r.plan.slug) });
      return;
    }
    await withDomainErrors(ctx, () => sendStarsInvoice(ctx, r.userId, r.plan));
  });

  bot.action(PAY_STARS_RE, async (ctx) => {
    const r = await resolve(ctx, ctx.match[1]);
    if (r) await withDomainErrors(ctx, () => sendStarsInvoice(ctx, r.userId, r.plan));
  });

  bot.action(PAY_PIX_RE, async (ctx) => {
    const r = await resolve(ctx, ctx.match[1]);
    if (r) await withDomainErrors(ctx, () => sendPixCharge(ctx, r.userId, r.plan));
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
