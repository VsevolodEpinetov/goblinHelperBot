import type { Context, Telegraf } from 'telegraf';

import { logger } from '../../core/observability';
import { requireRoles } from '../../core/permissions';
import { db } from '../../db/client';

import { POLLS_ROLES } from './constants';
import { addCoreStudio, addDynamicStudio } from './repo';
import { parseStudioName, summarizePoll } from './service';

async function ephemeralReply(ctx: Context, text: string, ms = 5000): Promise<void> {
  const sent = await ctx.reply(text);
  setTimeout(() => {
    ctx.deleteMessage(sent.message_id).catch(() => undefined);
  }, ms);
}

export function registerUserRoutes(bot: Telegraf): void {
  bot.command('add', requireRoles(...POLLS_ROLES), async (ctx) => {
    const text = ctx.message.text.replace(/^\/add\s*/i, '');
    const name = parseStudioName(text);
    if (!name) {
      await ephemeralReply(ctx, 'Не вижу название студии. Пример: /add Foo Studio');
      return;
    }
    const result = await addCoreStudio(db, name);
    await ephemeralReply(
      ctx,
      result === 'added'
        ? `Added ${name} to core studios`
        : `Studio ${name} already exists in core studios`,
    );
  });

  bot.hears('+', requireRoles(...POLLS_ROLES), async (ctx) => {
    const reply = ctx.message.reply_to_message;
    if (!reply) return;
    const raw =
      ('text' in reply ? reply.text : undefined) ??
      ('caption' in reply ? reply.caption : undefined);
    if (!raw) return;
    const name = parseStudioName(raw);
    if (!name) return;
    const result = await addDynamicStudio(db, name);
    await ephemeralReply(
      ctx,
      result === 'added' ? `Added ${name} to polls` : `Studio ${name} already exists in polls`,
    );
  });

  bot.command('count', requireRoles(...POLLS_ROLES), async (ctx) => {
    const reply = ctx.message.reply_to_message;
    if (!reply) {
      await ctx.reply('Ты промахнулся');
      return;
    }
    if (!('poll' in reply) || !reply.poll) {
      await ctx.reply('Промах');
      return;
    }
    let totalMembers = 0;
    try {
      totalMembers = (await ctx.getChatMembersCount()) - 1;
    } catch (err) {
      logger.warn({ err }, 'count: getChatMembersCount failed');
      await ctx.reply('Не удалось получить количество участников');
      return;
    }
    const text = summarizePoll(reply.poll, totalMembers);
    await ctx.reply(text, { parse_mode: 'HTML' });
  });
}
