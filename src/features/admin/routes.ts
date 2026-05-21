import { Markup, type Telegraf } from 'telegraf';

import { requireRoles } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';

import { userListKeyboard } from './menus';
import { searchUsers } from './repo';
import { adminCallback } from './schemas';
import { parseUserQuery } from './service';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

export function registerAdminCommands(bot: Telegraf): void {
  bot.command('admin', requireRoles(...ADMIN_ROLES), async (ctx) => {
    await ctx.reply(
      'Админ-меню:',
      Markup.inlineKeyboard([
        [Markup.button.callback('📅 Months', router.encode(adminCallback, { a: 'adMonths' }))],
      ]),
    );
  });

  bot.command('admin_find', requireRoles(...ADMIN_ROLES), async (ctx) => {
    const argv = ctx.message.text.replace(/^\/admin_find\s*/i, '').trim();
    if (!argv) {
      await ctx.reply('Использование: /admin_find <id или @username>');
      return;
    }
    try {
      const q = parseUserQuery(argv);
      const rows = await searchUsers(db, q, 20);
      if (rows.length === 0) {
        await ctx.reply('Не найдено.');
        return;
      }
      await ctx.reply(`Найдено: ${rows.length}`, userListKeyboard(rows));
    } catch (err) {
      await ctx.reply((err as Error).message);
    }
  });
}
