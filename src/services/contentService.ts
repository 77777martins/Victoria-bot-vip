import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export type MediaType = 'PHOTO' | 'VIDEO' | 'ANIMATION';

export const MAX_PREVIEWS = 10; // limite do sendMediaGroup
export const MAX_CAPTION = 1000; // Telegram aceita até 1024 em legendas

const welcomeSchema = z.object({
  mediaType: z.enum(['PHOTO', 'VIDEO', 'ANIMATION']).nullable(),
  fileId: z.string().min(1).nullable(),
  text: z.string().max(MAX_CAPTION).nullable(),
});
export type WelcomeContent = z.infer<typeof welcomeSchema>;

/** Telas com mídia configurável pelo admin. */
export type ScreenKey = 'welcome' | 'plans';
const EMPTY: WelcomeContent = { mediaType: null, fileId: null, text: null };

// Cache em memória: essas telas são lidas a cada /start e /planos
const cache = new Map<ScreenKey, WelcomeContent>();

export const contentService = {
  async getScreen(key: ScreenKey): Promise<WelcomeContent> {
    const cached = cache.get(key);
    if (cached) return cached;

    const row = await prisma.setting.findUnique({ where: { key } });
    let value = EMPTY;
    if (row) {
      try {
        value = welcomeSchema.parse(JSON.parse(row.value));
      } catch (err) {
        logger.error({ err, key }, 'setting de tela inválido — usando padrão');
      }
    }
    cache.set(key, value);
    return value;
  },

  async updateScreen(key: ScreenKey, patch: Partial<WelcomeContent>): Promise<WelcomeContent> {
    const next = welcomeSchema.parse({ ...(await this.getScreen(key)), ...patch });
    const value = JSON.stringify(next);
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    cache.set(key, next);
    return next;
  },

  getWelcome() {
    return this.getScreen('welcome');
  },

  updateWelcome(patch: Partial<WelcomeContent>) {
    return this.updateScreen('welcome', patch);
  },

  async listPreviews(): Promise<{ type: MediaType; fileId: string }[]> {
    return prisma.previewMedia.findMany({ orderBy: { sortOrder: 'asc' }, take: MAX_PREVIEWS });
  },

  async addPreview(type: MediaType, fileId: string): Promise<number> {
    const count = await prisma.previewMedia.count();
    if (count >= MAX_PREVIEWS) return -1;
    await prisma.previewMedia.create({ data: { type, fileId, sortOrder: count } });
    return count + 1;
  },

  async clearPreviews(): Promise<void> {
    await prisma.previewMedia.deleteMany({});
  },
};
