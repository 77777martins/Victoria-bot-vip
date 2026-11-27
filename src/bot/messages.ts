import { escapeHtml, formatBRL, formatDate } from '../lib/format';
import type { PlanDTO } from '../domain/types';
import { planBadge } from './planBadges';

export const messages = {
  ageGate: (name: string | null) =>
    `Oi${name ? `, ${escapeHtml(name)}` : ''}! 🔞\n\n` +
    'Este bot dá acesso a um <b>grupo VIP com conteúdo adulto</b>.\n\n' +
    'Para continuar, confirme que:\n' +
    '• você tem <b>18 anos ou mais</b>;\n' +
    '• aceita os termos de uso (/termos).',

  ageDeclined: 'Tudo bem. O acesso é exclusivo para maiores de 18 anos. 👋',

  /** Texto padrão — o admin pode trocar com /textoboasvindas */
  defaultWelcome:
    '🔥 Oi, amor! Que bom te ver por aqui 😘\n\n' +
    'No meu <b>VIP</b> você tem acesso a:\n' +
    '📸 Fotos e vídeos exclusivos que não posto em lugar nenhum\n' +
    '🆕 Conteúdo novo toda semana\n' +
    '🔒 Grupo 100% privado e discreto\n\n' +
    '👇 Toque abaixo e entre agora',

  planLine: (p: PlanDTO) => {
    const { icon, tag } = planBadge(p.slug);
    return `${icon} <b>${escapeHtml(p.name)}</b> — ${formatBRL(p.priceCents)}${tag ? `\n     <i>${tag}</i>` : ''}`;
  },

  plansList: (plans: PlanDTO[]) =>
    plans.length
      ? `💎 <b>Escolha seu acesso VIP</b>\n\n${plans.map(messages.planLine).join('\n\n')}\n\n` +
        '✅ Liberação automática na hora\n🔒 Pagamento seguro pelo Telegram (⭐ Stars)'
      : 'Nenhum plano disponível no momento.',

  /** Enviada no privado quando o assinante entra no grupo (editável com /textoentrada) */
  defaultMemberWelcome:
    '🎉 <b>Seja muito bem-vindo(a) ao meu VIP!</b> 😘\n\n' +
    'Agora você faz parte do meu cantinho exclusivo 🔥\n\n' +
    '📌 <b>Regrinhas rápidas:</b>\n' +
    '• Conteúdo só pra você — nada de print, gravar ou repassar\n' +
    '• Respeito sempre, comigo e com todo mundo\n' +
    '• Quem compartilhar conteúdo é removido sem reembolso\n\n' +
    '🆕 Tem conteúdo novo toda semana, fica de olho nas notificações 👀\n\n' +
    'Qualquer coisa sobre pagamento: /paysupport\n' +
    'Ver sua assinatura: /assinatura\n\n' +
    'Aproveita, amor 💋',

  previewsCta: '😏 Gostou? Isso é só uma amostra...\nNo VIP tem <b>muito mais</b>.',

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

  paymentMethod: (p: PlanDTO) =>
    `💎 <b>${escapeHtml(p.name)}</b> — ${formatBRL(p.priceCents)}\n\nComo você prefere pagar?`,

  pixCharge: (p: PlanDTO) =>
    `💠 <b>PIX — ${escapeHtml(p.name)}</b>\n` +
    `Valor: <b>${formatBRL(p.priceCents)}</b>\n\n` +
    '1️⃣ Escaneie o QR Code ou use o <b>copia e cola</b> abaixo\n' +
    '2️⃣ Pague o valor exato\n' +
    '3️⃣ <b>Envie aqui a foto/print do comprovante</b>\n\n' +
    'Assim que confirmarmos, você recebe o link do grupo 💋',

  pixCopyPaste: (code: string) => `<b>PIX copia e cola</b> (toque para copiar):\n\n<code>${escapeHtml(code)}</code>`,

  pixProofReceived:
    '✅ <b>Comprovante recebido!</b>\n\nEstamos conferindo o pagamento. Você recebe o link do grupo aqui assim que for aprovado. 💋',

  pixRejected:
    '❌ Não conseguimos identificar seu pagamento PIX.\n\nSe você pagou, fale com o suporte: /paysupport\nOu gere uma nova cobrança em /planos.',

  pixReviewAdmin: (r: { buyer: string; telegramId: number; planName: string; amountCents: number; txid: string | null; createdAt: Date }) =>
    '💠 <b>PIX para conferir</b>\n\n' +
    `Cliente: ${escapeHtml(r.buyer)} (<code>${r.telegramId}</code>)\n` +
    `Plano: ${escapeHtml(r.planName)}\n` +
    `Valor: <b>${formatBRL(r.amountCents)}</b>\n` +
    `ID PIX: <code>${escapeHtml(r.txid ?? '-')}</code>\n` +
    `Gerado em: ${formatDate(r.createdAt)}\n\n` +
    '⚠️ <b>Confira no app do banco</b> se o valor caiu antes de aprovar. Comprovante pode ser falso.',

  banned: 'Sua conta não tem permissão para usar este bot.',
  rateLimited: 'Calma 🙂 Aguarde alguns segundos e tente de novo.',
  genericError: 'Ops, algo deu errado. Tente novamente em instantes.',
};
