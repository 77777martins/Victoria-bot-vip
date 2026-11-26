import { Composer } from 'telegraf';
import type { BotContext } from '../../context';
import { logger } from '../../../lib/logger';
import { prisma } from '../../../lib/prisma';
import { formatBRL, formatDate } from '../../../lib/format';
import { userService } from '../../../services/userService';
import { planService } from '../../../services/planService';
import { paymentService } from '../../../services/paymentService';
import { subscriptionService } from '../../../services/subscriptionService';
import { args, audit, ID_RE } from './utils';

/** Vendas, acessos e banimentos. */
export const coreAdmin = new Composer<BotContext>();

coreAdmin.command('stats', async (ctx) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [users, active, paid, paid24h] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', provider: 'TELEGRAM_STARS' },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: 'PAID', provider: 'TELEGRAM_STARS', paidAt: { gte: since24h } } }),
  ]);
  await ctx.reply(
    `📊 <b>Estatísticas</b>\n\n` +
      `Usuários: ${users}\nAssinaturas ativas: ${active}\n` +
      `Vendas (total): ${paid._count} — ⭐ ${paid._sum.amount ?? 0}\n` +
      `Vendas (24h): ${paid24h}`,
    { parse_mode: 'HTML' },
  );
});

coreAdmin.command('liberar', async (ctx) => {
  const [id, slug] = args(ctx);
  if (!id || !ID_RE.test(id) || !slug) return ctx.reply('Uso: /liberar <telegramId> <plano>');

  const [user, plan] = await Promise.all([userService.findByTelegramId(Number(id)), planService.findActiveBySlug(slug)]);
  if (!user) return ctx.reply('Usuário não encontrado (ele precisa dar /start no bot antes).');
  if (!plan) return ctx.reply('Plano inválido.');

  const sub = await paymentService.grantManual(user.id, plan);
  const link = await ctx.access.createInviteLink(Number(id));
  await ctx.telegram
    .sendMessage(Number(id), `🎁 Acesso VIP liberado!\nEntre pelo link (válido 24h):\n${link}`)
    .catch((err: unknown) => logger.warn({ err }, 'não foi possível avisar o usuário'));

  audit(ctx, 'liberar', { telegramId: id, plan: slug });
  return ctx.reply(`✅ Liberado até ${sub.expiresAt ? formatDate(sub.expiresAt) : 'vitalício'}.`);
});

coreAdmin.command('banir', async (ctx) => {
  const [id] = args(ctx);
  if (!id || !ID_RE.test(id)) return ctx.reply('Uso: /banir <telegramId>');
  const user = await userService.findByTelegramId(Number(id));
  if (!user) return ctx.reply('Usuário não encontrado.');

  await userService.setBanned(user.id, true);
  await subscriptionService.revokeAllForUser(user.id);
  await ctx.access.ban(Number(id)).catch((err: unknown) => logger.warn({ err }, 'ban no grupo falhou'));

  audit(ctx, 'banir', { telegramId: id });
  return ctx.reply('🚫 Usuário banido e assinatura revogada.');
});

coreAdmin.command('desbanir', async (ctx) => {
  const [id] = args(ctx);
  if (!id || !ID_RE.test(id)) return ctx.reply('Uso: /desbanir <telegramId>');
  const user = await userService.findByTelegramId(Number(id));
  if (!user) return ctx.reply('Usuário não encontrado.');

  await userService.setBanned(user.id, false);
  await ctx.access.unban(Number(id)).catch(() => undefined);

  audit(ctx, 'desbanir', { telegramId: id });
  return ctx.reply('✅ Usuário desbanido (sem assinatura — use /liberar se quiser).');
});

coreAdmin.command('reembolsar', async (ctx) => {
  const [chargeId] = args(ctx);
  if (!chargeId || chargeId.length > 255) return ctx.reply('Uso: /reembolsar <chargeId>');

  const payment = await paymentService.findPaidByChargeId(chargeId);
  if (!payment || payment.status !== 'PAID') return ctx.reply('Pagamento pago não encontrado.');

  const telegramId = Number(payment.user.telegramId);
  await ctx.access.refundStars(telegramId, chargeId);
  await paymentService.markRefunded(payment.id);
  if (!(await subscriptionService.getActive(payment.userId))) {
    await ctx.access.kick(telegramId).catch(() => undefined);
  }

  audit(ctx, 'reembolsar', { paymentId: payment.id });
  return ctx.reply('💸 Reembolso feito e acesso revogado.');
});

const MIN_STARS = 1;
const MAX_STARS = 10_000;

coreAdmin.command('precostars', async (ctx) => {
  const [slug, value] = args(ctx);

  if (!slug) {
    const plans = await planService.listAll();
    const lines = plans.map((p) => `• ${p.slug}: ⭐ ${p.priceStars} (anunciado ${formatBRL(p.priceCents)})`);
    return ctx.reply(
      `⭐ Preços atuais em Stars:\n\n${lines.join('\n')}\n\n` +
        'Para mudar: /precostars <plano> <stars>\nEx.: /precostars semanal 150',
    );
  }

  const stars = Number(value);
  if (!Number.isInteger(stars) || stars < MIN_STARS || stars > MAX_STARS) {
    return ctx.reply(`Valor inválido. Use um número inteiro entre ${MIN_STARS} e ${MAX_STARS}.\nEx.: /precostars semanal 150`);
  }

  const plan = await planService.updateStars(slug.toLowerCase(), stars);
  if (!plan) return ctx.reply('Plano não encontrado. Veja os nomes com /precostars');

  audit(ctx, 'precostars', { slug: plan.slug, stars });
  return ctx.reply(`✅ ${plan.name} agora custa ⭐ ${stars}.\nLembre de ajustar preços escritos nos textos de venda, se houver.`);
});
