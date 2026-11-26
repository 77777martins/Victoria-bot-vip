/**
 * Horário de Brasília. O Brasil não usa horário de verão desde 2019,
 * então o offset fixo -03:00 é seguro (revisar se a regra mudar).
 */
const SP_OFFSET = '-03:00';
const SP_OFFSET_MS = -3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Data/hora atual em São Paulo: { date: 'YYYY-MM-DD', time: 'HH:mm' } */
export const nowInSaoPaulo = (now = new Date()) => {
  const sp = new Date(now.getTime() + SP_OFFSET_MS);
  return {
    date: `${sp.getUTCFullYear()}-${pad(sp.getUTCMonth() + 1)}-${pad(sp.getUTCDate())}`,
    time: `${pad(sp.getUTCHours())}:${pad(sp.getUTCMinutes())}`,
    year: sp.getUTCFullYear(),
  };
};

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Converte "25/12 20:00" (horário de Brasília) em Date. Retorna null se inválido. */
export const parseSaoPauloDateTime = (dayMonth: string, time: string, now = new Date()): Date | null => {
  const dm = /^(\d{1,2})\/(\d{1,2})$/.exec(dayMonth);
  if (!dm || !TIME_RE.test(time)) return null;
  const day = Number(dm[1]);
  const month = Number(dm[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const { year, date: today } = nowInSaoPaulo(now);
  // Só vira o ano quando faz sentido (ex.: em dezembro agendando para janeiro)
  const currentMonth = Number(today.slice(5, 7));
  const years = currentMonth >= 11 && month <= 2 ? [year, year + 1] : [year];
  for (const y of years) {
    const date = new Date(`${y}-${pad(month)}-${pad(day)}T${time}:00${SP_OFFSET}`);
    // Rejeita datas que "rolam" (ex.: 31/02) e escolhe a próxima ocorrência futura
    if (Number.isNaN(date.getTime())) return null;
    if (nowInSaoPaulo(date).date !== `${y}-${pad(month)}-${pad(day)}`) return null;
    if (date > now) return date;
  }
  return null;
};

/** Minutos desde 00:00 de um "HH:mm". */
export const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
