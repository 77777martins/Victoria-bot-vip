import { prisma } from '../lib/prisma';
import type { SubscriptionDTO } from '../domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Aceita o client padrão ou o client de uma $transaction. */
type Db = Pick<typeof prisma, 'subscription'>;

const activeWhere = (userId: string, now: Date) => ({
  userId,
  status: 'ACTIVE' as const,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

export const subscriptionService = {
  async getActive(userId: string, db: Db = prisma): Promise<SubscriptionDTO | null> {
    return db.subscription.findFirst({
      where: activeWhere(userId, new Date()),
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Concede/renova acesso. Se já houver assinatura ativa com prazo,
   * o novo período é somado ao final dela (o cliente não perde dias).
   * A assinatura anterior é encerrada para manter UMA ativa por usuário.
   */
  async grant(
    db: Db,
    params: { userId: string; planId: string; paymentId: string; durationDays: number | null },
  ): Promise<SubscriptionDTO> {
    const now = new Date();
    const current = await this.getActive(params.userId, db);

    let expiresAt: Date | null = null;
    if (params.durationDays !== null) {
      const base = current?.expiresAt && current.expiresAt > now ? current.expiresAt : now;
      expiresAt = new Date(base.getTime() + params.durationDays * DAY_MS);
    }

    if (current) {
      await db.subscription.update({ where: { id: current.id }, data: { status: 'EXPIRED' } });
    }

    return db.subscription.create({
      data: {
        userId: params.userId,
        planId: params.planId,
        paymentId: params.paymentId,
        status: 'ACTIVE',
        startsAt: now,
        expiresAt,
      },
    });
  },

  async revokeAllForUser(userId: string, db: Db = prisma): Promise<number> {
    const result = await db.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    return result.count;
  },

  async findExpired(limit = 100) {
    return prisma.subscription.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
      include: { user: true },
      take: limit,
    });
  },

  async findExpiringSoon(withinHours = 24, limit = 100) {
    const now = new Date();
    return prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        expiryNotifiedAt: null,
        expiresAt: { gt: now, lte: new Date(now.getTime() + withinHours * 60 * 60 * 1000) },
      },
      include: { user: true },
      take: limit,
    });
  },

  async markExpired(id: string): Promise<boolean> {
    // updateMany com filtro de status = idempotente mesmo com execuções concorrentes
    const result = await prisma.subscription.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    return result.count === 1;
  },

  async markNotified(id: string): Promise<void> {
    await prisma.subscription.update({ where: { id }, data: { expiryNotifiedAt: new Date() } });
  },
};
