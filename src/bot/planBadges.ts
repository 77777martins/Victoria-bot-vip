/** Destaques visuais por plano (marketing). Planos novos caem no padrão. */
const BADGES: Record<string, { icon: string; tag: string }> = {
  semanal: { icon: '⚡', tag: 'Para conhecer' },
  mensal: { icon: '🔥', tag: 'MAIS VENDIDO' },
  vitalicio: { icon: '💎', tag: 'MELHOR CUSTO — pague 1x, acesso pra sempre' },
};

export const planBadge = (slug: string) => BADGES[slug] ?? { icon: '⭐', tag: '' };
