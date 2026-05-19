import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { validateRaidPrice } from '../service';

export const priceScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:price');

priceScene.enter(async (ctx) => {
  await ctx.reply('Стоимость в рублях?');
});

priceScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

priceScene.on('text', async (ctx) => {
  try {
    const price = validateRaidPrice(ctx.message.text);
    const draft = ctx.scene.state as RaidDraft;
    draft.price = price;
    draft.currency = 'RUB';
    const next = RAID_CHAIN.nextOf('raid:price');
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
