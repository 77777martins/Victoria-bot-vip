import type { Telegram } from 'telegraf';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const INVITE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Operações no grupo VIP. O bot precisa ser ADMIN do grupo com permissão
 * de "Convidar usuários" e "Banir usuários".
 */
export const createAccessService = (telegram: Telegram) => ({
  /**
   * Link individual com "pedido para entrar": mesmo que o link vaze,
   * o bot só aprova quem tem assinatura ativa (ver joinRequest handler).
   */
  async createInviteLink(telegramId: number): Promise<string> {
    // Remove banimento antigo (ex.: assinatura expirada) para permitir reentrada
    await telegram
      .unbanChatMember(env.GROUP_CHAT_ID, telegramId, { only_if_banned: true })
      .catch((err: unknown) => logger.warn({ err, telegramId }, 'unban falhou'));

    const link = await telegram.createChatInviteLink(env.GROUP_CHAT_ID, {
      name: `u${telegramId}`.slice(0, 32),
      creates_join_request: true,
      expire_date: Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS,
    });
    return link.invite_link;
  },

  async approveJoin(telegramId: number): Promise<void> {
    await telegram.approveChatJoinRequest(env.GROUP_CHAT_ID, telegramId);
  },

  async declineJoin(telegramId: number): Promise<void> {
    await telegram.declineChatJoinRequest(env.GROUP_CHAT_ID, telegramId);
  },

  /** Remove do grupo sem banimento permanente (pode voltar ao renovar). */
  async kick(telegramId: number): Promise<void> {
    await telegram.banChatMember(env.GROUP_CHAT_ID, telegramId);
    await telegram.unbanChatMember(env.GROUP_CHAT_ID, telegramId, { only_if_banned: true });
  },

  /** Banimento permanente do grupo. */
  async ban(telegramId: number): Promise<void> {
    await telegram.banChatMember(env.GROUP_CHAT_ID, telegramId);
  },

  async unban(telegramId: number): Promise<void> {
    await telegram.unbanChatMember(env.GROUP_CHAT_ID, telegramId, { only_if_banned: true });
  },

  /**
   * Reembolso de Telegram Stars (Bot API 7.4+). A versão dos tipos do Telegraf
   * ainda não declara o método, por isso a chamada genérica isolada aqui.
   */
  async refundStars(telegramId: number, chargeId: string): Promise<void> {
    const callApi = telegram.callApi.bind(telegram) as unknown as (
      method: string,
      payload: Record<string, unknown>,
    ) => Promise<unknown>;
    await callApi('refundStarPayment', {
      user_id: telegramId,
      telegram_payment_charge_id: chargeId,
    });
  },
});

export type AccessService = ReturnType<typeof createAccessService>;
