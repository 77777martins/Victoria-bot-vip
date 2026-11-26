import { Composer, type Telegraf } from 'telegraf';
import type { BotContext } from '../context';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { formatDate } from '../../lib/format';
import { userService } from '../../services/userService';
import { planService } from '../../services/planService';
import { paymentService } from '../../services/paymentService';
import { subscriptionService } from '../../services/subscriptionService';
import { contentService, MAX_CAPTION, type MediaType } from '../../services/contentService';
import { sendWelcome } from '../presenters';

const HELP =
  '🛠 <b>Admin</b>\n\n' +
  '/stats — resumo de vendas\n' +
  '/liberar &lt;telegramId&gt; &lt;semanal|mensal|vitalicio&gt;\n' +
  '/banir &lt;telegramId&gt; — remove e bloqueia\n' +
  '/desbanir &lt;telegramId&gt;\n' +
  '/reembolsar &lt;chargeId&gt; — devolve Stars e revoga\n\n' +
  '🎨 <b>Visual de vendas</b>\n' +
  '<i>Responda a uma foto/vídeo com:</i>\n' +
  '/boasvindas — define a mídia da tela inicial\n' +
  '/addprevia — adiciona prévia (máx. 10)\n\n' +
  '/textoboasvindas &lt;texto&gt; — troca o texto inicial\n' +
  '/textopadrao — volta ao texto padrão\n' +
  '/removermidia — tira a foto/vídeo inicial\n' +
  '/limparprevias — apaga todas as prévias\n' +
  '/vercomocliente — mostra a tela como o cliente vê';

const ID_RE = /^\d{1,15}$/;

/** Extrai foto/vídeo da mensagem respondida pelo admin. */
const repliedMedia = (ctx: BotContext): { type: MediaType; fileId: string; caption?: string } | null => {
  const reply = ctx.message && 'reply_to_message' in ctx.message ? ctx.message.reply_to_message : undefined;
  if (!reply) return null;
  const caption = 'caption' in reply ? reply.caption : undefined;
  if ('photo' in reply && reply.photo.length) {
    const largest = reply.photo[reply.photo.length - 1]!;
    return { type: 'PHOTO', fileId: largest.file_id, caption };
  }
  if ('video' in reply) return { type: 'VIDEO', fileId: reply.video.file_id, caption };
  return null;
};

/** Texto após o comando, preservando quebras de linha. */
const commandText = (ctx: BotContext): string =>
  ctx.message && 'text' in ctx.message ? ctx.message.text.replace(/^\/\S+\s*/, '').trim() : '';

const args = (ctx: BotContext): string[] =>
  ctx.message && 'text' in ctx.message ? ctx.message.text.trim().split(/\s+/).slice(1) : [];

const audit = (ctx: BotContext, action: string, extra: Record<string, unknown> = {}) =>
  logger.info({ adminId: ctx.from?.id, action, ...extra }, 'ação admin');

export const registerAdminHandlers = (bot: Telegraf<BotContext>): void => {
  const admin = new Composer<BotContext>();

  admin.command('admin', (ctx) => ctx.reply(HELP, { parse_mode: 'HTML' }));

  admin.command('stats', async (ctx) => {
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

  admin.command('liberar', async (ctx) => {
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

  admin.command('banir', async (ctx) => {
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

  admin.command('desbanir', async (ctx) => {
    const [id] = args(ctx);
    if (!id || !ID_RE.test(id)) return ctx.reply('Uso: /desbanir <telegramId>');
    const user = await userService.findByTelegramId(Number(id));
    if (!user) return ctx.reply('Usuário não encontrado.');

    await userService.setBanned(user.id, false);
    await ctx.access.unban(Number(id)).catch(() => undefined);

    audit(ctx, 'desbanir', { telegramId: id });
    return ctx.reply('✅ Usuário desbanido (sem assinatura — use /liberar se quiser).');
  });

  admin.command('reembolsar', async (ctx) => {
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

  admin.command('boasvindas', async (ctx) => {
    const media = repliedMedia(ctx);
    if (!media) return ctx.reply('Envie uma foto ou vídeo e RESPONDA a ela com /boasvindas.');
    await contentService.updateWelcome({
      mediaType: media.type,
      fileId: media.fileId,
      ...(media.caption ? { text: media.caption.slice(0, MAX_CAPTION) } : {}),
    });
    audit(ctx, 'boasvindas', { type: media.type });
    return ctx.reply('✅ Tela inicial atualizada. Veja com /vercomocliente');
  });

  admin.command('textoboasvindas', async (ctx) => {
    const text = commandText(ctx);
    if (!text) return ctx.reply('Uso: /textoboasvindas seu texto aqui (pode ter várias linhas)');
    if (text.length > MAX_CAPTION) return ctx.reply(`Texto muito longo (${text.length}/${MAX_CAPTION}).`);
    await contentService.updateWelcome({ text });
    audit(ctx, 'textoboasvindas');
    return ctx.reply('✅ Texto atualizado. Veja com /vercomocliente');
  });

  admin.command('textopadrao', async (ctx) => {
    await contentService.updateWelcome({ text: null });
    return ctx.reply('✅ Voltou ao texto padrão.');
  });

  admin.command('removermidia', async (ctx) => {
    await contentService.updateWelcome({ mediaType: null, fileId: null });
    return ctx.reply('✅ Mídia inicial removida.');
  });

  admin.command('addprevia', async (ctx) => {
    const media = repliedMedia(ctx);
    if (!media) return ctx.reply('Envie uma foto ou vídeo e RESPONDA a ela com /addprevia.');
    const total = await contentService.addPreview(media.type, media.fileId);
    if (total === -1) return ctx.reply('Limite de 10 prévias. Use /limparprevias para recomeçar.');
    audit(ctx, 'addprevia', { type: media.type });
    return ctx.reply(`✅ Prévia adicionada (${total}/10).`);
  });

  admin.command('limparprevias', async (ctx) => {
    await contentService.clearPreviews();
    audit(ctx, 'limparprevias');
    return ctx.reply('🗑 Prévias apagadas.');
  });

  admin.command('vercomocliente', (ctx) => sendWelcome(ctx));

  // Só executa para IDs de admin em chat privado; para os demais, é ignorado silenciosamente.
  bot.use(
    Composer.optional<BotContext>(
      (ctx) => ctx.chat?.type === 'private' && !!ctx.from && env.ADMIN_IDS.has(ctx.from.id),
      admin,
    ),
  );
};
