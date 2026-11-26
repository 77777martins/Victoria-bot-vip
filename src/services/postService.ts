import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { TIME_RE } from '../lib/time';
import type { MediaType } from './contentService';

export const MAX_POSTING_TIMES = 6;
const POSTING_TIMES_KEY = 'postingTimes';
const LAST_SLOT_KEY = 'lastPostSlot';

export interface PostDTO {
  id: string;
  mediaType: MediaType | null;
  fileId: string | null;
  caption: string | null;
  scheduledAt: Date | null;
}

const timesSchema = z.array(z.string().regex(TIME_RE)).max(MAX_POSTING_TIMES);

const getSetting = async (key: string) => (await prisma.setting.findUnique({ where: { key } }))?.value ?? null;
const setSetting = (key: string, value: string) =>
  prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

export const postService = {
  async create(data: Omit<PostDTO, 'id'>): Promise<PostDTO> {
    return prisma.scheduledPost.create({ data: { ...data, status: 'PENDING' } });
  },

  async listPending(limit = 15): Promise<PostDTO[]> {
    return prisma.scheduledPost.findMany({
      where: { status: 'PENDING' },
      // Datados primeiro (por data), depois a fila (por ordem de chegada)
      orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: limit,
    });
  },

  async countQueue(): Promise<number> {
    return prisma.scheduledPost.count({ where: { status: 'PENDING', scheduledAt: null } });
  },

  /** Cancela pelo código curto (início do id) mostrado em /agendados. */
  async cancelByShortId(shortId: string): Promise<boolean> {
    const post = await prisma.scheduledPost.findFirst({ where: { status: 'PENDING', id: { startsWith: shortId } } });
    if (!post) return false;
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'CANCELED' } });
    return true;
  },

  async findDueDated(limit = 20): Promise<PostDTO[]> {
    return prisma.scheduledPost.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  },

  async nextInQueue(): Promise<PostDTO | null> {
    return prisma.scheduledPost.findFirst({
      where: { status: 'PENDING', scheduledAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Marca como enviado só se ainda estiver pendente (evita post duplicado). */
  async claim(id: string): Promise<boolean> {
    const res = await prisma.scheduledPost.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return res.count === 1;
  },

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.scheduledPost.update({ where: { id }, data: { status: 'FAILED', error: error.slice(0, 500) } });
  },

  async getPostingTimes(): Promise<string[]> {
    const raw = await getSetting(POSTING_TIMES_KEY);
    if (!raw) return [];
    try {
      const parsed = timesSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  },

  async setPostingTimes(times: string[]): Promise<void> {
    const unique = [...new Set(timesSchema.parse(times))].sort();
    await setSetting(POSTING_TIMES_KEY, JSON.stringify(unique));
  },

  getLastSlot: () => getSetting(LAST_SLOT_KEY),
  setLastSlot: (slot: string) => setSetting(LAST_SLOT_KEY, slot),
};
