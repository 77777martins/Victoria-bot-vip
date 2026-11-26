import type { BotContext } from './context';
import { keyboards } from './keyboards';
import { messages } from './messages';
import { contentService } from '../services/contentService';
import { escapeHtml } from '../lib/format';

/** Tela de boas-vindas: foto/vídeo + texto de venda + botões. */
export const sendWelcome = async (ctx: BotContext): Promise<void> => {
  const [welcome, previews] = await Promise.all([contentService.getWelcome(), contentService.listPreviews()]);

  // Texto do admin é escapado (texto puro); o padrão já é HTML confiável.
  const caption = welcome.text ? escapeHtml(welcome.text) : messages.defaultWelcome;
  const extra = { caption, parse_mode: 'HTML' as const, protect_content: true, ...keyboards.mainMenu(previews.length > 0) };

  if (welcome.fileId && welcome.mediaType === 'PHOTO') {
    await ctx.replyWithPhoto(welcome.fileId, extra);
  } else if (welcome.fileId && welcome.mediaType === 'VIDEO') {
    await ctx.replyWithVideo(welcome.fileId, extra);
  } else {
    await ctx.reply(caption, { parse_mode: 'HTML', protect_content: true, ...keyboards.mainMenu(previews.length > 0) });
  }
};

/** Álbum de prévias protegido contra encaminhar/salvar + chamada para compra. */
export const sendPreviews = async (ctx: BotContext): Promise<void> => {
  const previews = await contentService.listPreviews();
  if (!previews.length) {
    await ctx.reply('Ainda não há prévias. Veja os planos:', keyboards.cta());
    return;
  }

  await ctx.replyWithMediaGroup(
    previews.map((p) =>
      p.type === 'PHOTO' ? { type: 'photo' as const, media: p.fileId } : { type: 'video' as const, media: p.fileId },
    ),
    { protect_content: true },
  );
  await ctx.reply(messages.previewsCta, { parse_mode: 'HTML', ...keyboards.cta() });
};
