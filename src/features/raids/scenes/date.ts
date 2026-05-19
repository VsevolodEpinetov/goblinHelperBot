import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { parseRaidDate } from '../service';

export const dateScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:date');

dateScene.enter(async (ctx) => {
  await ctx.reply('Дата окончания в формате ДД.ММ или ДД.ММ.ГГГГ.');
});

dateScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

dateScene.on('text', async (ctx) => {
  const parsed = parseRaidDate(ctx.message.text);
  if (!parsed) {
    await ctx.reply('Не могу разобрать дату. Попробуй ДД.ММ или ДД.ММ.ГГГГ.');
    return;
  }
  const draft = ctx.scene.state as RaidDraft;
  draft.endDate = parsed.toISOString();
  const next = RAID_CHAIN.nextOf('raid:date');
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});
