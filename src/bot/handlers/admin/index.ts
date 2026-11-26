import { Composer, type Telegraf } from 'telegraf';
import type { BotContext } from '../../context';
import { env } from '../../../config/env';
import { coreAdmin } from './core';
import { contentAdmin } from './content';
import { marketingAdmin } from './marketing';
import { postsAdmin } from './posts';

const HELP =
  '🛠 <b>Admin</b>\n\n' +
  '/stats — resumo de vendas\n' +
  '/liberar &lt;telegramId&gt; &lt;semanal|mensal|vitalicio&gt;\n' +
  '/banir &lt;telegramId&gt; | /desbanir &lt;telegramId&gt;\n' +
  '/reembolsar &lt;chargeId&gt;\n' +
  '/precostars [plano] [stars] — ver/alterar preço em ⭐\n\n' +
  '🎨 <b>Visual de vendas</b> <i>(responda a uma foto/vídeo)</i>\n' +
  '/boasvindas — capa da tela inicial\n' +
  '/addprevia — prévia (máx. 10)\n' +
  '/midiaplanos — vídeo junto com os planos\n' +
  '/textoboasvindas &lt;texto&gt; | /textopadrao\n' +
  '/removermidia | /removermidiaplanos | /limparprevias\n' +
  '/vercomocliente\n\n' +
  '🎉 <b>Boas-vindas de quem entra no grupo</b> <i>(no privado)</i>\n' +
  '/entradagrupo <i>(respondendo a mídia)</i> | /textoentrada &lt;texto&gt;\n' +
  '/verentrada | /entradapadrao\n\n' +
  '📣 <b>Remarketing</b> <i>(quem não comprou)</i>\n' +
  '/remarketing &lt;horas&gt; [texto]\n' +
  '/verremarketing | /testarremarketing &lt;n&gt; | /removerremarketing &lt;n&gt;\n\n' +
  '🗓 <b>Posts no grupo VIP</b> <i>(horário de Brasília)</i>\n' +
  '/agendar 25/12 20:00 [texto]\n' +
  '/fila [texto] — entra na fila diária\n' +
  '/horarios 12:00,20:00 | /horarios off\n' +
  '/agendados | /cancelarpost &lt;código&gt;';

export const registerAdminHandlers = (bot: Telegraf<BotContext>): void => {
  const admin = new Composer<BotContext>();
  admin.command('admin', (ctx) => ctx.reply(HELP, { parse_mode: 'HTML' }));
  admin.use(coreAdmin, contentAdmin, marketingAdmin, postsAdmin);

  // Só executa para IDs de admin em chat privado; para os demais, é ignorado.
  bot.use(
    Composer.optional<BotContext>(
      (ctx) => ctx.chat?.type === 'private' && !!ctx.from && env.ADMIN_IDS.has(ctx.from.id),
      admin,
    ),
  );
};
