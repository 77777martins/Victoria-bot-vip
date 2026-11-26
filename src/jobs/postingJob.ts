import type { Telegram } from 'telegraf';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { minutesOf, nowInSaoPaulo } from '../lib/time';
import { sendMediaMessage } from '../bot/mediaSender';
import { postService, type PostDTO } from '../services/postService';

const INTERVAL_MS = 60 * 1000;
/** Se o bot ficou fora do ar, só recupera horários dos últimos 30 min. */
const SLOT_GRACE_MIN = 30;

const publish = async (telegram: Telegram, post: PostDTO): Promise<void> => {
  if (!(await postService.claim(post.id))) return; // já enviado por outra execução
  try {
    // Legenda do admin vai como texto puro (sem parse_mode) — sem risco de markup quebrado
    await sendMediaMessage(telegram, env.GROUP_CHAT_ID, { ...post, text: post.caption });
    logger.info({ postId: post.id }, 'post publicado no grupo');
  } catch (err) {
    logger.error({ err, postId: post.id }, 'falha ao publicar post');
    await postService.markFailed(post.id, err instanceof Error ? err.message : 'erro desconhecido');
  }
};

/** Próximo horário da fila que já passou hoje e ainda não foi usado. */
const dueSlot = async (): Promise<string | null> => {
  const times = await postService.getPostingTimes();
  if (!times.length) return null;

  const { date, time } = nowInSaoPaulo();
  const nowMin = minutesOf(time);
  const last = await postService.getLastSlot();

  for (const t of [...times].reverse()) {
    const diff = nowMin - minutesOf(t);
    if (diff < 0 || diff > SLOT_GRACE_MIN) continue;
    const slot = `${date} ${t}`;
    return last && last >= slot ? null : slot;
  }
  return null;
};

export const startPostingJob = (telegram: Telegram): (() => void) => {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      for (const post of await postService.findDueDated()) await publish(telegram, post);

      const slot = await dueSlot();
      if (slot) {
        await postService.setLastSlot(slot);
        const next = await postService.nextInQueue();
        if (next) await publish(telegram, next);
      }
    } catch (err) {
      logger.error({ err }, 'erro no job de posts');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void run(), INTERVAL_MS);
  return () => clearInterval(timer);
};
