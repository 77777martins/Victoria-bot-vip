/**
 * Tipos de domínio espelhando os enums/modelos do Prisma.
 * Mantidos aqui para que a camada de bot não dependa diretamente do client gerado.
 */
export type PaymentProvider = 'TELEGRAM_STARS' | 'MANUAL' | 'PIX_MANUAL';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED' | 'REJECTED';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface PlanDTO {
  id: string;
  slug: string;
  name: string;
  durationDays: number | null;
  priceCents: number;
  priceStars: number;
}

export interface UserDTO {
  id: string;
  telegramId: bigint;
  firstName: string | null;
  ageConfirmedAt: Date | null;
  isBanned: boolean;
}

export interface SubscriptionDTO {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  expiresAt: Date | null;
}

/** Erro de regra de negócio — mensagem é segura para mostrar ao usuário. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
