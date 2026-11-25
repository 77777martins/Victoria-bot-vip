const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

export const formatBRL = (cents: number): string => brl.format(cents / 100);
export const formatDate = (date: Date): string => dateFmt.format(date);

/** Escapa texto do usuário para parse_mode HTML (previne injeção de markup). */
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
