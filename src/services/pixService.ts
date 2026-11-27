import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { buildPixPayload } from '../lib/pix';
import { DomainError, type PlanDTO, type SubscriptionDTO } from '../domain/types';
import { subscriptionService } from './subscriptionService';

/** Comprovante só é aceito para cobranças PIX geradas nas últimas 48h. */
const PROOF_WINDOW_MS = 48 * 60 * 60 * 1000;

export const isPixEnabled = (): boolean => Boolean(env.PIX_KEY);

type ReviewResult =
  | { ok: true; telegramId: number; subscription: SubscriptionDTO | null }
  | { ok: false; reason: 'not_found' | 'already_reviewed' };

/**
 * PIX estático com aprovação manual: o bot gera o BR Code e o admin
 * confirma o recebimento no app do banco antes de liberar.
 */
export const pixService = {
  async createCharge(userId: string, plan: PlanDTO) {
    if (!env.PIX_KEY || !env.PIX_MERCHANT_NAME || !env.PIX_MERCHANT_CITY) {
      throw new DomainError('PIX indisponível no momento. Pague com Stars ⭐');
    }
    const active = await subscriptionService.getActive(userId);
    if (active && active.expiresAt === null) throw new DomainError('Você já tem acesso vitalício. 💎');

    // txid curto e único: aparece no extrato de muitos bancos e ajuda a conferir
    const txid = `VIP${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    const payment = await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        provider: 'PIX_MANUAL',
        status: 'PENDING',
        amount: plan.priceCents,
        currency: 'BRL',
        invoicePayload: `pix:${randomUUID()}`,
        pixTxid: txid,
      },
    });

    const copyPaste = buildPixPayload({
      key: env.PIX_KEY,
      merchantName: env.PIX_MERCHANT_NAME,
      merchantCity: env.PIX_MERCHANT_CITY,
      amountCents: plan.priceCents,
      txid,
    });
    return { payment, copyPaste };
  },

  /** Cobrança PIX mais recente do usuário ainda aguardando comprovante. */
  async findAwaitingProof(userId: string) {
    return prisma.payment.findFirst({
      where: {
        userId,
        provider: 'PIX_MANUAL',
        status: 'PENDING',
        proofFileId: null,
        createdAt: { gte: new Date(Date.now() - PROOF_WINDOW_MS) },
      },
      include: { plan: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async attachProof(paymentId: string, fileId: string): Promise<boolean> {
    const res = await prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING', proofFileId: null },
      data: { proofFileId: fileId, proofSubmittedAt: new Date() },
    });
    return res.count === 1;
  },

  /** Aprova e libera o acesso. Idempotente: dois admins clicando não duplicam nada. */
  async approve(paymentId: string, adminTelegramId: number): Promise<ReviewResult> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM "Payment" WHERE id = ${paymentId} AND provider = 'PIX_MANUAL' FOR UPDATE`;
      const row = locked[0];
      if (!row) return { ok: false, reason: 'not_found' } as const;
      if (row.status !== 'PENDING') return { ok: false, reason: 'already_reviewed' } as const;

      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: new Date(), reviewedBy: BigInt(adminTelegramId) },
        include: { plan: true, user: true },
      });
      const subscription = await subscriptionService.grant(tx, {
        userId: payment.userId,
        planId: payment.planId,
        paymentId: payment.id,
        durationDays: payment.plan.durationDays,
      });
      return { ok: true, telegramId: Number(payment.user.telegramId), subscription } as const;
    });
  },

  async reject(paymentId: string, adminTelegramId: number): Promise<ReviewResult> {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, provider: 'PIX_MANUAL' },
      include: { user: true },
    });
    if (!payment) return { ok: false, reason: 'not_found' };

    const res = await prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedBy: BigInt(adminTelegramId) },
    });
    if (res.count === 0) return { ok: false, reason: 'already_reviewed' };
    return { ok: true, telegramId: Number(payment.user.telegramId), subscription: null };
  },

  async countAwaitingReview(): Promise<number> {
    return prisma.payment.count({
      where: { provider: 'PIX_MANUAL', status: 'PENDING', proofFileId: { not: null } },
    });
  },
};
