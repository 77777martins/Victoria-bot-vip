import { Markup } from 'telegraf';
import { formatBRL } from '../lib/format';
import type { PlanDTO } from '../domain/types';
import { planBadge } from './planBadges';

export const CB = {
  ageAccept: 'age:accept',
  ageDecline: 'age:decline',
  plans: 'menu:plans',
  status: 'menu:status',
  previews: 'menu:previews',
  optOut: 'mkt:optout',
  buyPrefix: 'buy:',
  payStarsPrefix: 'pay:stars:',
  payPixPrefix: 'pay:pix:',
  pixApprovePrefix: 'pix:ok:',
  pixRejectPrefix: 'pix:no:',
} as const;

export const keyboards = {
  ageGate: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Tenho 18+ e aceito os termos', CB.ageAccept)],
      [Markup.button.callback('❌ Sair', CB.ageDecline)],
    ]),

  mainMenu: (hasPreviews: boolean) =>
    Markup.inlineKeyboard([
      [Markup.button.callback('💎 QUERO SER VIP', CB.plans)],
      ...(hasPreviews ? [[Markup.button.callback('👀 Ver prévias', CB.previews)]] : []),
      [Markup.button.callback('📋 Minha assinatura', CB.status)],
    ]),

  plans: (plans: PlanDTO[]) =>
    Markup.inlineKeyboard(
      plans.map((p) => [
        Markup.button.callback(
          `${planBadge(p.slug).icon} ${p.name} — ${formatBRL(p.priceCents)}`,
          `${CB.buyPrefix}${p.slug}`,
        ),
      ]),
    ),

  remarketing: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('🔥 QUERO SER VIP', CB.plans)],
      [Markup.button.callback('🔕 Não quero receber mensagens', CB.optOut)],
    ]),

  paymentMethod: (slug: string) =>
    Markup.inlineKeyboard([
      [Markup.button.callback('💠 Pagar com PIX', `${CB.payPixPrefix}${slug}`)],
      [Markup.button.callback('⭐ Pagar com Stars (liberação automática)', `${CB.payStarsPrefix}${slug}`)],
    ]),

  pixReview: (paymentId: string) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Aprovar', `${CB.pixApprovePrefix}${paymentId}`),
        Markup.button.callback('❌ Recusar', `${CB.pixRejectPrefix}${paymentId}`),
      ],
    ]),

  cta: () => Markup.inlineKeyboard([[Markup.button.callback('🔥 QUERO ACESSO COMPLETO', CB.plans)]]),

  renew: () => Markup.inlineKeyboard([[Markup.button.callback('🔄 Renovar', CB.plans)]]),
};
