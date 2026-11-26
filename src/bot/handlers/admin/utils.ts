import type { BotContext } from '../../context';
import { logger } from '../../../lib/logger';
import type { MediaType } from '../../../services/contentService';

export const ID_RE = /^\d{1,15}$/;

/** Extrai foto/vídeo da mensagem respondida pelo admin. */
export const repliedMedia = (ctx: BotContext): { type: MediaType; fileId: string; caption?: string } | null => {
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
export const commandText = (ctx: BotContext): string =>
  ctx.message && 'text' in ctx.message ? ctx.message.text.replace(/^\/\S+\s*/, '').trim() : '';

export const args = (ctx: BotContext): string[] =>
  ctx.message && 'text' in ctx.message ? ctx.message.text.trim().split(/\s+/).slice(1) : [];

export const audit = (ctx: BotContext, action: string, extra: Record<string, unknown> = {}) =>
  logger.info({ adminId: ctx.from?.id, action, ...extra }, 'ação admin');
