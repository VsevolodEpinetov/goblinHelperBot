import type { Scenes, Telegraf } from 'telegraf';

import { db } from '../../db/client';

import { formatRaidMessage, formatRaidShortLine } from './format';
import { creatorControlsKeyboard, publicRaidKeyboard } from './menus';
import {
  getRaidById,
  getRaidParticipants,
  listRaids,
  listRaidsByCreator,
  listRaidsForParticipant,
} from './repo';
import { RAID_CHAIN } from './scene-chain';

export function registerRaidCommands(bot: Telegraf): void {
  bot.command('raid', async (ctx) => {
    if (!ctx.from) return;
    await (ctx as unknown as Scenes.SceneContext).scene.enter(RAID_CHAIN.steps[0]!);
  });

  bot.command('raids', async (ctx) => {
    const rows = await listRaids(db, { status: 'open', limit: 20 });
    if (rows.length === 0) {
      await ctx.reply('Открытых рейдов нет.');
      return;
    }
    await ctx.reply(rows.map(formatRaidShortLine).join('\n'));
  });

  bot.command('myraids', async (ctx) => {
    if (!ctx.from) return;
    const created = await listRaidsByCreator(db, ctx.from.id);
    const joined = await listRaidsForParticipant(db, ctx.from.id);
    const lines: string[] = [];
    if (created.length > 0) {
      lines.push('<b>Создал:</b>');
      lines.push(...created.map(formatRaidShortLine));
    }
    if (joined.length > 0) {
      lines.push('<b>Участвую:</b>');
      lines.push(...joined.map(formatRaidShortLine));
    }
    if (lines.length === 0) lines.push('Пока ничего.');
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  bot.command('raidinfo', async (ctx) => {
    if (!ctx.from) return;
    const match = /^\/raidinfo\s+(\d+)/.exec(ctx.message.text);
    if (!match) {
      await ctx.reply('Использование: /raidinfo <id>');
      return;
    }
    const id = Number(match[1]);
    const raid = await getRaidById(db, id);
    if (!raid) {
      await ctx.reply('Рейд не найден');
      return;
    }
    const participants = await getRaidParticipants(db, id);
    const text = formatRaidMessage(raid, participants);
    const isCreator = raid.createdBy === ctx.from.id;
    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...(isCreator ? creatorControlsKeyboard(raid) : publicRaidKeyboard(raid)),
    });
  });
}
