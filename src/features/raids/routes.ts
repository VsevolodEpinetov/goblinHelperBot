import type { Scenes, Telegraf } from 'telegraf';

import { requireApprovedMember } from '../../core/permissions';

import { renderMyRaids, renderOpenRaids, renderRaidCard } from './actions';
import { RAID_CHAIN } from './scene-chain';

export function registerRaidCommands(bot: Telegraf): void {
  bot.command('raid', requireApprovedMember(), async (ctx) => {
    if (!ctx.from) return;
    await (ctx as unknown as Scenes.SceneContext).scene.enter(RAID_CHAIN.steps[0]!);
  });

  bot.command('raids', requireApprovedMember(), async (ctx) => {
    await renderOpenRaids(ctx, 0);
  });

  bot.command('myraids', requireApprovedMember(), async (ctx) => {
    await renderMyRaids(ctx, 0);
  });

  bot.command('raidinfo', requireApprovedMember(), async (ctx) => {
    if (!ctx.from) return;
    const match = /^\/raidinfo\s+(\d+)/.exec(ctx.message.text);
    if (!match) {
      await ctx.reply('Использование: /raidinfo <id>');
      return;
    }
    await renderRaidCard(ctx, Number(match[1]));
  });
}
