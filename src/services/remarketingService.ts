import { prisma } from '../lib/prisma';
import type { MediaType } from './contentService';

export const MAX_REMARKETING_STEPS = 5;
export const MAX_DELAY_HOURS = 30 * 24;

export interface RemarketingStepDTO {
  id: string;
  delayHours: number;
  mediaType: MediaType | null;
  fileId: string | null;
  text: string;
}

const HOUR_MS = 60 * 60 * 1000;

export const remarketingService = {
  async listSteps(): Promise<RemarketingStepDTO[]> {
    return prisma.remarketingStep.findMany({ orderBy: [{ delayHours: 'asc' }, { createdAt: 'asc' }] });
  },

  async addStep(data: Omit<RemarketingStepDTO, 'id'>): Promise<number> {
    const count = await prisma.remarketingStep.count();
    if (count >= MAX_REMARKETING_STEPS) return -1;
    await prisma.remarketingStep.create({ data });
    return count + 1;
  },

  async removeStep(id: string): Promise<void> {
    await prisma.remarketingStep.delete({ where: { id } });
  },

  /**
   * Usuários elegíveis para o passo `index`: passaram pelo 18+, nunca compraram,
   * não pediram para sair e já atingiram o atraso do passo.
   */
  async findDueUsers(index: number, delayHours: number, limit: number) {
    return prisma.user.findMany({
      where: {
        remarketingStep: { lte: index },
        isBanned: false,
        marketingOptOut: false,
        ageConfirmedAt: { lte: new Date(Date.now() - delayHours * HOUR_MS) },
        payments: { none: { status: 'PAID' } },
      },
      select: { id: true, telegramId: true },
      take: limit,
    });
  },

  async advance(userId: string, nextStep: number): Promise<void> {
    // Nunca retrocede (seguro contra execuções sobrepostas)
    await prisma.user.updateMany({
      where: { id: userId, remarketingStep: { lt: nextStep } },
      data: { remarketingStep: nextStep },
    });
  },

  async optOut(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { marketingOptOut: true } });
  },
};
