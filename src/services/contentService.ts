import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export type MediaType = 'PHOTO' | 'VIDEO';

export const MAX_PREVIEWS = 10; // limite do sendMediaGroup
export const MAX_CAPTION = 1000; // Telegram aceita até 1024 em legendas

const welcomeSchema = z.object({
  mediaType: z.enum(['PHOTO', 'VIDEO']).nullable(),
  fileId: z.string().min(1).nullable(),
  text: z.string().max(MAX_CAPTION).nullable(),
});
export type WelcomeContent = z.infer<typeof welcomeSchema>;

const WELCOME_KEY = 'welcome';
const EMPTY_WELCOME: WelcomeContent = { mediaType: null, fileId: null, text: null };

// Cache simples: a boas-vindas é lida em todo /start
let welcomeCache: WelcomeContent | null = null;

export const contentService = {
  async getWelcome(): Promise<WelcomeContent> {
    if (welcomeCache) return welcomeCache;
    const row = await prisma.setting.findUnique({ where: { key: WELCOME_KEY } });
    if (!row) return (welcomeCache = EMPTY_WELCOME);

    try {
      welcomeCache = welcomeSchema.parse(JSON.parse(row.value));
    } catch (err) {
      logger.error({ err }, 'setting welcome inválido — usando padrão');
      welcomeCache = EMPTY_WELCOME;
    }
    return welcomeCache;
  },

  async updateWelcome(patch: Partial<WelcomeContent>): Promise<WelcomeContent> {
    const next = welcomeSchema.parse({ ...(await this.getWelcome()), ...patch });
    const value = JSON.stringify(next);
    await prisma.setting.upsert({
      where: { key: WELCOME_KEY },
      update: { value },
      create: { key: WELCOME_KEY, value },
    });
    welcomeCache = next;
    return next;
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
