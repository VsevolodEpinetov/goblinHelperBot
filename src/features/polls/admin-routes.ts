import type { Telegraf } from 'telegraf';

import { requireRoles } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';

import { POLLS_ROLES } from './constants';
import { adminMenu } from './menus';
import { listCoreStudios, listDynamicStudios, resetCoreStudios, resetDynamicStudios } from './repo';
import { pollsCallback } from './schemas';

export function registerAdminRoutes(bot: Telegraf): void {
  bot.command('polls', requireRoles(...POLLS_ROLES), async (ctx) => {
    await ctx.reply('Polls admin:', adminMenu());
  });

  router.on(pollsCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!POLLS_ROLES.some((r) => roles.includes(r))) {
      await ctx.answerCbQuery?.('Недостаточно прав');
      return;
    }

    switch (payload.a) {
      case 'polCoreList': {
        const rows = await listCoreStudios(db);
        const body =
          rows.length === 0 ? 'Core list is empty' : rows.map((r) => `• ${r.name}`).join('\n');
        await ctx.editMessageText(body);
        break;
      }
      case 'polDynList': {
        const rows = await listDynamicStudios(db);
        const body =
          rows.length === 0 ? 'Dynamic list is empty' : rows.map((r) => `• ${r.name}`).join('\n');
        await ctx.editMessageText(body);
        break;
      }
      case 'polCoreReset': {
        const n = await resetCoreStudios(db);
        await ctx.editMessageText(`Core list cleared (${n} rows)`);
        break;
      }
      case 'polDynReset': {
        const n = await resetDynamicStudios(db);
        await ctx.editMessageText(`Dynamic list cleared (${n} rows)`);
        break;
      }
    }
    await ctx.answerCbQuery?.();
  });
}
