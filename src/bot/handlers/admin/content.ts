import { Composer } from 'telegraf';
import type { BotContext } from '../../context';
import { contentService, MAX_CAPTION } from '../../../services/contentService';
import { sendMemberWelcome, sendWelcome } from '../../presenters';
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
  if (media.type === 'ANIMATION') return ctx.reply('GIFs não podem ir no álbum de prévias. Envie como vídeo com som ou foto.');
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

contentAdmin.command('midiaplanos', async (ctx) => {
  const media = repliedMedia(ctx);
  if (!media) return ctx.reply('Envie um vídeo, foto ou GIF e RESPONDA a ele com /midiaplanos.');
  await contentService.updateScreen('plans', { mediaType: media.type, fileId: media.fileId });
  audit(ctx, 'midiaplanos', { type: media.type });
  return ctx.reply('✅ Mídia dos planos atualizada. Veja com /planos');
});

contentAdmin.command('removermidiaplanos', async (ctx) => {
  await contentService.updateScreen('plans', { mediaType: null, fileId: null });
  return ctx.reply('✅ Planos voltam a aparecer só com texto.');
});

// Boas-vindas para quem entra no grupo VIP (enviada no privado)
contentAdmin.command('entradagrupo', async (ctx) => {
  const media = repliedMedia(ctx);
  if (!media) return ctx.reply('Envie uma foto, vídeo ou GIF e RESPONDA a ele com /entradagrupo.\nSó texto? Use /textoentrada seu texto');
  await contentService.updateScreen('member', {
    mediaType: media.type,
    fileId: media.fileId,
    ...(media.caption ? { text: media.caption.slice(0, MAX_CAPTION) } : {}),
  });
  audit(ctx, 'entradagrupo', { type: media.type });
  return ctx.reply('✅ Boas-vindas do grupo atualizada. Veja com /verentrada');
});

contentAdmin.command('textoentrada', async (ctx) => {
  const text = commandText(ctx);
  if (!text) return ctx.reply('Uso: /textoentrada seu texto aqui (pode ter várias linhas)');
  if (text.length > MAX_CAPTION) return ctx.reply(`Texto muito longo (${text.length}/${MAX_CAPTION}).`);
  await contentService.updateScreen('member', { text });
  audit(ctx, 'textoentrada');
  return ctx.reply('✅ Texto atualizado. Veja com /verentrada');
});

contentAdmin.command('entradapadrao', async (ctx) => {
  await contentService.updateScreen('member', { mediaType: null, fileId: null, text: null });
  return ctx.reply('✅ Boas-vindas do grupo voltou ao padrão.');
});

contentAdmin.command('verentrada', async (ctx) => {
  if (ctx.from) await sendMemberWelcome(ctx.telegram, ctx.from.id);
});
