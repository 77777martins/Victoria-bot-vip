import { escapeHtml, formatBRL, formatDate } from '../lib/format';
import type { PlanDTO } from '../domain/types';

export const messages = {
  ageGate: (name: string | null) =>
    `Oi${name ? `, ${escapeHtml(name)}` : ''}! 🔞\n\n` +
    'Este bot dá acesso a um <b>grupo VIP com conteúdo adulto</b>.\n\n' +
    'Para continuar, confirme que:\n' +
    '• você tem <b>18 anos ou mais</b>;\n' +
    '• aceita os termos de uso (/termos).',

  ageDeclined: 'Tudo bem. O acesso é exclusivo para maiores de 18 anos. 👋',

  welcome: '✨ Bem-vindo(a) ao VIP da <b>Victoria</b>!\n\nEscolha seu plano abaixo:',

  planLine: (p: PlanDTO) => `• <b>${escapeHtml(p.name)}</b> — ${formatBRL(p.priceCents)} (⭐ ${p.priceStars})`,

  plansList: (plans: PlanDTO[]) =>
    plans.length
      ? `💎 <b>Planos disponíveis</b>\n\n${plans.map(messages.planLine).join('\n')}\n\nPagamento seguro via Telegram Stars ⭐`
      : 'Nenhum plano disponível no momento.',

  invoiceTitle: (p: PlanDTO) => `VIP Victoria — ${p.name}`.slice(0, 32),
  invoiceDescription: (p: PlanDTO) =>
    (p.durationDays ? `Acesso ao grupo VIP por ${p.durationDays} dias.` : 'Acesso vitalício ao grupo VIP.').slice(0, 255),

  paymentApproved: (link: string, expiresAt: Date | null) =>
    '✅ <b>Pagamento confirmado!</b>\n\n' +
    (expiresAt ? `Seu acesso vale até <b>${formatDate(expiresAt)}</b>.\n\n` : 'Seu acesso é <b>vitalício</b>. 💎\n\n') +
    `Toque para entrar no grupo (link pessoal, válido por 24h):\n${link}\n\n` +
    'Ao tocar, clique em "Pedir para entrar" — a aprovação é automática.',

  status: (planName: string, expiresAt: Date | null) =>
    `📋 <b>Sua assinatura</b>\n\nPlano: ${escapeHtml(planName)}\n` +
    (expiresAt ? `Válida até: <b>${formatDate(expiresAt)}</b>` : 'Validade: <b>vitalícia</b> 💎'),

  noSubscription: 'Você não tem assinatura ativa. Veja os planos em /planos.',

  expiringSoon: (expiresAt: Date) =>
    `⏰ Seu acesso VIP termina em <b>${formatDate(expiresAt)}</b>.\nRenove agora para não perder nada:`,

  expired: '⌛ Sua assinatura expirou e o acesso ao grupo foi removido.\nRenove quando quiser:',

  terms:
    '📜 <b>Termos de uso</b>\n\n' +
    '1. Acesso exclusivo para maiores de 18 anos.\n' +
    '2. O conteúdo é de uso pessoal. É proibido copiar, gravar, revender ou compartilhar.\n' +
    '3. Compartilhamento de conteúdo ou links resulta em banimento sem reembolso.\n' +
    '4. Assinaturas com prazo não renovam automaticamente.\n' +
    '5. Problemas com pagamento: /paysupport.',

  paySupport: (username?: string) =>
    '🛟 <b>Suporte de pagamento</b>\n\n' +
    (username ? `Fale com @${username} informando seu ID: ` : 'Responda esta mensagem informando seu ID: '),

  saleNotice: (s: { buyer: string; telegramId: number; planName: string; stars: number; chargeId: string }) =>
    '💰 <b>Nova venda!</b>\n\n' +
    `Cliente: ${escapeHtml(s.buyer)} (<code>${s.telegramId}</code>)\n` +
    `Plano: ${escapeHtml(s.planName)}\n` +
    `Valor: ⭐ ${s.stars}\n\n` +
    `Reembolso: <code>/reembolsar ${escapeHtml(s.chargeId)}</code>`,

  banned: 'Sua conta não tem permissão para usar este bot.',
  rateLimited: 'Calma 🙂 Aguarde alguns segundos e tente de novo.',
  genericError: 'Ops, algo deu errado. Tente novamente em instantes.',
};
