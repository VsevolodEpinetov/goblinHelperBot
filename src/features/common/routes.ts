import type { Telegraf } from 'telegraf';

import { logger } from '../../core/observability';

import { rollDice } from './service';

export function register(bot: Telegraf): void {
  bot.command('id', async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await ctx.reply(`Твой telegram ID: ${ctx.from.id}\nЧат: ${ctx.chat.id}`);
  });

  bot.hears(/^\/roll(?:\s+(\d+))?\s*$/, async (ctx) => {
    const raw = ctx.match[1];
    const max = raw ? Number(raw) : 6;
    try {
      const result = rollDice(max);
      await ctx.reply(String(result));
    } catch (err) {
      logger.debug({ err, max }, 'rollDice rejected input');
      await ctx.reply('Использование: /roll <число от 1 до 1000000>');
    }
  });

  bot.command('info', async (ctx) => {
    if (!ctx.from) return;
    const roles = ctx.state.roles ?? [];
    await ctx.reply(
      [
        `<b>Твоя информация</b>`,
        `ID: <code>${ctx.from.id}</code>`,
        `Роли: ${roles.length === 0 ? '—' : roles.join(', ')}`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });
}
