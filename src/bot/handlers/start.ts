import type { Telegraf } from 'telegraf';
import type { BotContext } from '../context';
import { CB, keyboards } from '../keyboards';
import { messages } from '../messages';
import { userService } from '../../services/userService';
import { env } from '../../config/env';

export const registerStartHandlers = (bot: Telegraf<BotContext>): void => {
  bot.start(async (ctx) => {
    const user = ctx.appUser;
    if (!user) return;
    if (!user.ageConfirmedAt) {
      await ctx.reply(messages.ageGate(user.firstName), { parse_mode: 'HTML', ...keyboards.ageGate() });
      return;
    }
    await ctx.reply(messages.welcome, { parse_mode: 'HTML', ...keyboards.mainMenu() });
  });

  bot.action(CB.ageAccept, async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.appUser) return;
    await userService.confirmAgeAndTerms(ctx.appUser.id);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await ctx.reply(messages.welcome, { parse_mode: 'HTML', ...keyboards.mainMenu() });
  });

  bot.action(CB.ageDecline, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    await ctx.reply(messages.ageDeclined);
  });

  bot.command('termos', (ctx) => ctx.reply(messages.terms, { parse_mode: 'HTML' }));

  // Exigido pelo Telegram para bots que vendem com Stars
  bot.command('paysupport', (ctx) =>
    ctx.reply(`${messages.paySupport(env.SUPPORT_USERNAME)}<code>${ctx.from.id}</code>`, { parse_mode: 'HTML' }),
  );
};
