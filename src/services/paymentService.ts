import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { DomainError, type PlanDTO, type SubscriptionDTO } from '../domain/types';
import { subscriptionService } from './subscriptionService';

export const STARS_CURRENCY = 'XTR';

type PreCheckoutResult = { ok: true } | { ok: false; reason: string };

export interface ConfirmResult {
  alreadyProcessed: boolean;
  subscription: SubscriptionDTO | null;
}

/**
 * Regras de pagamento independentes do provedor.
 * Hoje: Telegram Stars. Um provedor PIX futuro reutiliza createPending/confirm.
 */
export const paymentService = {
  async createPending(userId: string, plan: PlanDTO) {
    const active = await subscriptionService.getActive(userId);
    if (active && active.expiresAt === null) {
      throw new DomainError('Você já tem acesso vitalício. 💎');
    }

    return prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        provider: 'TELEGRAM_STARS',
        status: 'PENDING',
        amount: plan.priceStars,
        currency: STARS_CURRENCY,
        invoicePayload: randomUUID(),
      },
    });
  },

  /** Validação obrigatória antes do Telegram cobrar o usuário. */
  async validatePreCheckout(input: {
    payload: string;
    telegramId: number;
    amount: number;
    currency: string;
  }): Promise<PreCheckoutResult> {
    const payment = await prisma.payment.findUnique({
      where: { invoicePayload: input.payload },
      include: { user: true, plan: true },
    });

    if (!payment || payment.status !== 'PENDING') {
      return { ok: false, reason: 'Esta cobrança não é mais válida. Gere uma nova com /planos.' };
    }
    if (payment.user.telegramId !== BigInt(input.telegramId)) {
      return { ok: false, reason: 'Cobrança não pertence a esta conta.' };
    }
    if (payment.user.isBanned) {
      return { ok: false, reason: 'Conta sem permissão para compras.' };
    }
    if (!payment.plan.isActive) {
      return { ok: false, reason: 'Este plano não está mais disponível.' };
    }
    if (payment.amount !== input.amount || payment.currency !== input.currency) {
      logger.warn({ paymentId: payment.id }, 'pre_checkout com valor divergente');
      return { ok: false, reason: 'Valor divergente. Gere uma nova cobrança com /planos.' };
    }
    const active = await subscriptionService.getActive(payment.userId);
    if (active && active.expiresAt === null) {
      return { ok: false, reason: 'Você já tem acesso vitalício.' };
    }
    return { ok: true };
  },

  /**
   * Confirma o pagamento e libera o acesso. Idempotente:
   * reprocessar o mesmo payload/chargeId não gera assinatura duplicada.
   */
  async confirm(input: {
    payload: string;
    providerChargeId: string;
    amount: number;
    currency: string;
  }): Promise<ConfirmResult> {
    return prisma.$transaction(async (tx) => {
      // Trava a linha do pagamento para evitar corrida entre updates duplicados
      const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM "Payment" WHERE "invoicePayload" = ${input.payload} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new Error(`Pagamento não encontrado para payload ${input.payload}`);
      if (row.status === 'PAID') return { alreadyProcessed: true, subscription: null };

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: row.id },
        include: { plan: true },
      });

      if (payment.amount !== input.amount || payment.currency !== input.currency) {
        // O Telegram já cobrou: registra para reembolso manual em vez de descartar.
        logger.error({ paymentId: payment.id }, 'successful_payment com valor divergente');
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', providerChargeId: input.providerChargeId, paidAt: new Date() },
      });

      const subscription = await subscriptionService.grant(tx, {
        userId: payment.userId,
        planId: payment.planId,
        paymentId: payment.id,
        durationDays: payment.plan.durationDays,
      });

      return { alreadyProcessed: false, subscription };
    });
  },

  /** Liberação manual pelo admin (cortesia, suporte etc.). */
  async grantManual(userId: string, plan: PlanDTO): Promise<SubscriptionDTO> {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId,
          planId: plan.id,
          provider: 'MANUAL',
          status: 'PAID',
          amount: 0,
          currency: STARS_CURRENCY,
          invoicePayload: `manual:${randomUUID()}`,
          paidAt: new Date(),
        },
      });
      return subscriptionService.grant(tx, {
        userId,
        planId: plan.id,
        paymentId: payment.id,
        durationDays: plan.durationDays,
      });
    });
  },

  async findPaidByChargeId(chargeId: string) {
    return prisma.payment.findUnique({
      where: { providerChargeId: chargeId },
      include: { user: true, subscription: true },
    });
  },

  async markRefunded(paymentId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
      await tx.subscription.updateMany({
        where: { paymentId, status: 'ACTIVE' },
        data: { status: 'REVOKED' },
      });
    });
  },
};
