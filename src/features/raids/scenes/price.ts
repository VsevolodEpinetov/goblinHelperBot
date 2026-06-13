import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { validateRaidPrice } from '../service';

import { attachWizardCancel, raidWizardCancelKb } from './_cancel';

export const priceScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:price');
attachWizardCancel(priceScene);

priceScene.enter(async (ctx) => {
  await ctx.reply('Стоимость в рублях?', raidWizardCancelKb);
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
