import { Composer } from 'telegraf';
import type { BotContext } from '../../context';
import { escapeHtml, formatDate } from '../../../lib/format';
import { parseSaoPauloDateTime, TIME_RE } from '../../../lib/time';
import { MAX_CAPTION, type MediaType } from '../../../services/contentService';
import { MAX_POSTING_TIMES, postService } from '../../../services/postService';
import { args, audit, commandText, repliedMedia } from './utils';

/** Posts automáticos no grupo VIP: data marcada ou fila diária. */
export const postsAdmin = new Composer<BotContext>();

const MAX_DAYS_AHEAD = 60;
const shortId = (id: string) => id.slice(0, 6);

type BuiltPost =
  | { ok: true; data: { mediaType: MediaType | null; fileId: string | null; caption: string | null } }
  | { ok: false; error: string };

/** Monta o post a partir da mídia respondida e/ou texto livre. */
const buildPost = (ctx: BotContext, text: string): BuiltPost => {
  const media = repliedMedia(ctx);
  const caption = (text || media?.caption || '').trim() || null;
  if (!media && !caption) return { ok: false, error: 'Responda a uma foto/vídeo ou escreva um texto.' };
  if (caption && caption.length > MAX_CAPTION) {
    return { ok: false, error: `Texto muito longo (${caption.length}/${MAX_CAPTION}).` };
  }
  return { ok: true, data: { mediaType: media?.type ?? null, fileId: media?.fileId ?? null, caption } };
};

postsAdmin.command('agendar', async (ctx) => {
  const [day, time] = args(ctx);
  const when = day && time ? parseSaoPauloDateTime(day, time) : null;
  if (!when) {
    return ctx.reply('Data inválida ou no passado.\n\nUso (horário de Brasília):\n• Responda a uma foto/vídeo com: /agendar 25/12 20:00\n• Só texto: /agendar 25/12 20:00 Seu texto');
  }
  if (when.getTime() - Date.now() > MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    return ctx.reply(`Agende com no máximo ${MAX_DAYS_AHEAD} dias de antecedência.`);
  }

  const post = buildPost(ctx, commandText(ctx).replace(/^\S+\s+\S+\s*/, ''));
  if (!post.ok) return ctx.reply(post.error);

  await postService.create({ ...post.data, scheduledAt: when });
  audit(ctx, 'post:agendar', { when: when.toISOString() });
  return ctx.reply(`✅ Agendado para ${formatDate(when)}.`);
});

postsAdmin.command('fila', async (ctx) => {
  const post = buildPost(ctx, commandText(ctx));
  if (!post.ok) return ctx.reply(`${post.error}\nUso: responda a uma foto/vídeo com /fila`);

  await postService.create({ ...post.data, scheduledAt: null });
  const [queue, times] = await Promise.all([postService.countQueue(), postService.getPostingTimes()]);
  audit(ctx, 'post:fila');
  return ctx.reply(
    `✅ Adicionado à fila (${queue} na fila).` +
      (times.length ? `\nPosta nos horários: ${times.join(', ')}` : '\n⚠️ Defina os horários com /horarios 12:00,20:00'),
  );
});

postsAdmin.command('horarios', async (ctx) => {
  const raw = args(ctx).join('');
  if (raw === 'off') {
    await postService.setPostingTimes([]);
    return ctx.reply('⏸ Fila pausada (nenhum horário).');
  }

  const times = raw.split(',').map((t) => t.trim()).filter(Boolean);
  if (!times.length || times.length > MAX_POSTING_TIMES || !times.every((t) => TIME_RE.test(t))) {
    const current = await postService.getPostingTimes();
    return ctx.reply(
      `Horários atuais: ${current.length ? current.join(', ') : 'nenhum'}\n\n` +
        `Uso: /horarios 12:00,20:00 (até ${MAX_POSTING_TIMES}, horário de Brasília)\nPausar: /horarios off`,
    );
  }

  await postService.setPostingTimes(times);
  audit(ctx, 'post:horarios', { times });
  return ctx.reply(`✅ A fila vai postar 1 item por horário: ${[...new Set(times)].sort().join(', ')}`);
});

postsAdmin.command('agendados', async (ctx) => {
  const [posts, queue] = await Promise.all([postService.listPending(), postService.countQueue()]);
  if (!posts.length) return ctx.reply('Nenhum post pendente.\nUse /agendar ou /fila.');

  const lines = posts.map((p) => {
    const icon = p.mediaType === 'PHOTO' ? '📸' : p.mediaType === 'VIDEO' ? '🎥' : '💬';
    const when = p.scheduledAt ? formatDate(p.scheduledAt) : 'fila';
    const text = p.caption ? escapeHtml(p.caption.slice(0, 40)) : '';
    return `<code>${shortId(p.id)}</code> ${icon} ${when} ${text}`;
  });
  return ctx.reply(
    `🗓 <b>Posts pendentes</b> (fila: ${queue})\n\n${lines.join('\n')}\n\nCancelar: /cancelarpost &lt;código&gt;`,
    { parse_mode: 'HTML' },
  );
});

postsAdmin.command('cancelarpost', async (ctx) => {
  const [code] = args(ctx);
  if (!code || !/^[0-9a-f-]{6,36}$/i.test(code)) return ctx.reply('Uso: /cancelarpost <código> (veja /agendados)');
  const ok = await postService.cancelByShortId(code.toLowerCase());
  if (ok) audit(ctx, 'post:cancelar', { code });
  return ctx.reply(ok ? '🗑 Post cancelado.' : 'Post não encontrado.');
});
