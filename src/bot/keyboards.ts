import { Markup } from 'telegraf';
import { formatBRL } from '../lib/format';
import type { PlanDTO } from '../domain/types';

export const CB = {
  ageAccept: 'age:accept',
  ageDecline: 'age:decline',
  plans: 'menu:plans',
  status: 'menu:status',
  buyPrefix: 'buy:',
} as const;

export const keyboards = {
  ageGate: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Tenho 18+ e aceito os termos', CB.ageAccept)],
      [Markup.button.callback('❌ Sair', CB.ageDecline)],
    ]),

  mainMenu: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('💎 Ver planos', CB.plans)],
      [Markup.button.callback('📋 Minha assinatura', CB.status)],
    ]),

  plans: (plans: PlanDTO[]) =>
    Markup.inlineKeyboard(
      plans.map((p) => [Markup.button.callback(`${p.name} — ${formatBRL(p.priceCents)}`, `${CB.buyPrefix}${p.slug}`)]),
    ),

  renew: () => Markup.inlineKeyboard([[Markup.button.callback('🔄 Renovar', CB.plans)]]),
};
