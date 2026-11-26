import type { BotContext } from './context';
import { keyboards } from './keyboards';
import { messages } from './messages';
import { sendMediaMessage } from './mediaSender';
import { contentService } from '../services/contentService';
import { planService } from '../services/planService';
import { escapeHtml } from '../lib/format';

/** Tela de boas-vindas: foto/vídeo/GIF + texto de venda + botões. */
export const sendWelcome = async (ctx: BotContext): Promise<void> => {
  if (!ctx.chat) return;
  const [welcome, previews] = await Promise.all([contentService.getWelcome(), contentService.listPreviews()]);

  // Texto do admin é escapado (texto puro); o padrão já é HTML confiável.
  const text = welcome.text ? escapeHtml(welcome.text) : messages.defaultWelcome;
  await sendMediaMessage(
    ctx.telegram,
    ctx.chat.id,
    { mediaType: welcome.mediaType, fileId: welcome.fileId, text },
    { parseMode: 'HTML', replyMarkup: keyboards.mainMenu(previews.length > 0).reply_markup },
  );
};

/** Lista de planos, opcionalmente acompanhada de vídeo/foto/GIF configurado pelo admin. */
export const sendPlans = async (ctx: BotContext): Promise<void> => {
  if (!ctx.chat) return;
  const [plans, media] = await Promise.all([planService.listActive(), contentService.getScreen('plans')]);
  await sendMediaMessage(
    ctx.telegram,
    ctx.chat.id,
    { mediaType: media.mediaType, fileId: media.fileId, text: messages.plansList(plans) },
    { parseMode: 'HTML', replyMarkup: keyboards.plans(plans).reply_markup },
  );
};

/** Álbum de prévias protegido contra encaminhar/salvar + chamada para compra. */
export const sendPreviews = async (ctx: BotContext): Promise<void> => {
  const previews = (await contentService.listPreviews()).filter((p) => p.type !== 'ANIMATION');
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
