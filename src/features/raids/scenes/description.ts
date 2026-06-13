import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { validateRaidDescription } from '../service';

import { attachWizardCancel, raidWizardCancelKb } from './_cancel';

export const descriptionScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:description');
attachWizardCancel(descriptionScene);

descriptionScene.enter(async (ctx) => {
  await ctx.reply('Описание (10–2000 символов).', raidWizardCancelKb);
});

descriptionScene.on('text', async (ctx) => {
  try {
    const description = validateRaidDescription(ctx.message.text);
    const draft = ctx.scene.state as RaidDraft;
    draft.description = description;
    const next = RAID_CHAIN.nextOf('raid:description');
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
