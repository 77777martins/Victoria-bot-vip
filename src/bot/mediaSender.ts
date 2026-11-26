import type { Telegram } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';
import type { MediaType } from '../services/contentService';

export interface MediaMessage {
  mediaType: MediaType | null;
  fileId: string | null;
  /** Texto puro (será escapado pelo chamador se necessário) */
  text: string | null;
}

/**
 * Envia foto, vídeo ou texto com o mesmo formato de opções.
 * Sempre com protect_content (bloqueia encaminhar/salvar).
 */
export const sendMediaMessage = async (
  telegram: Telegram,
  chatId: number,
  msg: MediaMessage,
  opts: { parseMode?: 'HTML'; replyMarkup?: InlineKeyboardMarkup } = {},
): Promise<void> => {
  const common = {
    protect_content: true,
    ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  };
  const caption = msg.text ?? undefined;

  if (msg.fileId && msg.mediaType === 'PHOTO') {
    await telegram.sendPhoto(chatId, msg.fileId, { ...common, caption });
  } else if (msg.fileId && msg.mediaType === 'VIDEO') {
    await telegram.sendVideo(chatId, msg.fileId, { ...common, caption });
  } else if (caption) {
    await telegram.sendMessage(chatId, caption, common);
  }
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Erro 403 = usuário bloqueou o bot. */
export const isBlockedError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 403;
