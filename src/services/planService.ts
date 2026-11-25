import { prisma } from '../lib/prisma';
import type { PlanDTO } from '../domain/types';

export const planService = {
  async listActive(): Promise<PlanDTO[]> {
    return prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  },

  async findById(id: string): Promise<PlanDTO | null> {
    return prisma.plan.findUnique({ where: { id } });
  },

  async findActiveBySlug(slug: string): Promise<PlanDTO | null> {
    return prisma.plan.findFirst({ where: { slug, isActive: true } });
  },
};
