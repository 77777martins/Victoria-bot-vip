import { Composer } from 'telegraf';
import type { BotContext } from '../../context';
import { escapeHtml } from '../../../lib/format';
import { MAX_CAPTION } from '../../../services/contentService';
import {
  MAX_DELAY_HOURS,
  MAX_REMARKETING_STEPS,
  remarketingService,
} from '../../../services/remarketingService';
import { keyboards } from '../../keyboards';
import { sendMediaMessage } from '../../mediaSender';
import { args, audit, commandText, repliedMedia } from './utils';

/** Sequência automática para quem entrou e não comprou. */
export const marketingAdmin = new Composer<BotContext>();

const USAGE =
  'Uso:\n' +
  '• Responda a uma foto/vídeo com: /remarketing 2\n' +
  '  (envia 2h depois; a legenda vira o texto)\n' +
  '• Só texto: /remarketing 24 Seu texto aqui';

marketingAdmin.command('remarketing', async (ctx) => {
  const [hoursArg] = args(ctx);
  const hours = Number(hoursArg);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_DELAY_HOURS) return ctx.reply(USAGE);

  const media = repliedMedia(ctx);
  const inlineText = commandText(ctx).replace(/^\d+\s*/, '');
  const text = (inlineText || media?.caption || '').trim();
  if (!text) return ctx.reply('A mensagem precisa de texto (legenda da foto ou texto após as horas).');
  if (text.length > MAX_CAPTION) return ctx.reply(`Texto muito longo (${text.length}/${MAX_CAPTION}).`);

  const total = await remarketingService.addStep({
    delayHours: hours,
    mediaType: media?.type ?? null,
    fileId: media?.fileId ?? null,
    text,
  });
  if (total === -1) return ctx.reply(`Limite de ${MAX_REMARKETING_STEPS} mensagens. Remova uma antes.`);

  audit(ctx, 'remarketing:add', { hours });
  return ctx.reply(`✅ Mensagem ${total}/${MAX_REMARKETING_STEPS} criada: envia ${hours}h após a pessoa entrar.\nVeja com /verremarketing`);
});

marketingAdmin.command('verremarketing', async (ctx) => {
  const steps = await remarketingService.listSteps();
  if (!steps.length) return ctx.reply(`Nenhuma mensagem de remarketing.\n\n${USAGE}`);

  const lines = steps.map((s, i) => {
    const icon = s.mediaType === 'PHOTO' ? '📸' : s.mediaType === 'VIDEO' ? '🎥' : '💬';
    const preview = s.text.length > 60 ? `${s.text.slice(0, 60)}…` : s.text;
    return `<b>${i + 1}.</b> ${icon} após ${s.delayHours}h — ${escapeHtml(preview)}`;
  });
  return ctx.reply(
    `📣 <b>Remarketing</b> (para quem não comprou)\n\n${lines.join('\n')}\n\n` +
      '/testarremarketing &lt;n&gt; — recebe a mensagem\n/removerremarketing &lt;n&gt; — apaga',
    { parse_mode: 'HTML' },
  );
});

const stepByNumber = async (ctx: BotContext) => {
  const n = Number(args(ctx)[0]);
  const steps = await remarketingService.listSteps();
  return Number.isInteger(n) && n >= 1 ? steps[n - 1] : undefined;
};

marketingAdmin.command('testarremarketing', async (ctx) => {
  const step = await stepByNumber(ctx);
  if (!step || !ctx.chat) return ctx.reply('Número inválido. Veja /verremarketing');
  await sendMediaMessage(
    ctx.telegram,
    ctx.chat.id,
    { ...step, text: escapeHtml(step.text) },
    { parseMode: 'HTML', replyMarkup: keyboards.remarketing().reply_markup },
  );
});

marketingAdmin.command('removerremarketing', async (ctx) => {
  const step = await stepByNumber(ctx);
  if (!step) return ctx.reply('Número inválido. Veja /verremarketing');
  await remarketingService.removeStep(step.id);
  audit(ctx, 'remarketing:remove', { id: step.id });
  return ctx.reply('🗑 Mensagem removida.');
});
