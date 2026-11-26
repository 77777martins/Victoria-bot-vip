import { Composer } from 'telegraf';
import type { BotContext } from '../../context';
import { contentService, MAX_CAPTION } from '../../../services/contentService';
import { sendWelcome } from '../../presenters';
import { audit, commandText, repliedMedia } from './utils';

/** Visual de vendas: capa, texto e prévias. */
export const contentAdmin = new Composer<BotContext>();

contentAdmin.command('boasvindas', async (ctx) => {
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

contentAdmin.command('textoboasvindas', async (ctx) => {
  const text = commandText(ctx);
  if (!text) return ctx.reply('Uso: /textoboasvindas seu texto aqui (pode ter várias linhas)');
  if (text.length > MAX_CAPTION) return ctx.reply(`Texto muito longo (${text.length}/${MAX_CAPTION}).`);
  await contentService.updateWelcome({ text });
  audit(ctx, 'textoboasvindas');
  return ctx.reply('✅ Texto atualizado. Veja com /vercomocliente');
});

contentAdmin.command('textopadrao', async (ctx) => {
  await contentService.updateWelcome({ text: null });
  return ctx.reply('✅ Voltou ao texto padrão.');
});

contentAdmin.command('removermidia', async (ctx) => {
  await contentService.updateWelcome({ mediaType: null, fileId: null });
  return ctx.reply('✅ Mídia inicial removida.');
});

contentAdmin.command('addprevia', async (ctx) => {
  const media = repliedMedia(ctx);
  if (!media) return ctx.reply('Envie uma foto ou vídeo e RESPONDA a ela com /addprevia.');
  const total = await contentService.addPreview(media.type, media.fileId);
  if (total === -1) return ctx.reply('Limite de 10 prévias. Use /limparprevias para recomeçar.');
  audit(ctx, 'addprevia', { type: media.type });
  return ctx.reply(`✅ Prévia adicionada (${total}/10).`);
});

contentAdmin.command('limparprevias', async (ctx) => {
  await contentService.clearPreviews();
  audit(ctx, 'limparprevias');
  return ctx.reply('🗑 Prévias apagadas.');
});

contentAdmin.command('vercomocliente', (ctx) => sendWelcome(ctx));
