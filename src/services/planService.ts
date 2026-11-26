import { prisma } from '../lib/prisma';
import type { PlanDTO } from '../domain/types';

export const planService = {
  async listActive(): Promise<PlanDTO[]> {
    return prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  },

  async findById(id: string): Promise<PlanDTO | null> {
    return prisma.plan.findUnique({ where: { id } });
  },

  async listAll(): Promise<PlanDTO[]> {
    return prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  },

  /** Altera só o preço em Stars. Cobranças já geradas mantêm o valor antigo (snapshot no Payment). */
  async updateStars(slug: string, priceStars: number): Promise<PlanDTO | null> {
    const plan = await prisma.plan.findUnique({ where: { slug } });
    if (!plan) return null;
    return prisma.plan.update({ where: { slug }, data: { priceStars } });
  },

  async findActiveBySlug(slug: string): Promise<PlanDTO | null> {
    return prisma.plan.findFirst({ where: { slug, isActive: true } });
  },
};
