import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { validateRaidTitle } from '../service';

import { attachWizardCancel, raidWizardCancelKb } from './_cancel';

export const titleScene = new Scenes.BaseScene<Scenes.SceneContext>(RAID_CHAIN.steps[0]!);
attachWizardCancel(titleScene);

titleScene.enter(async (ctx) => {
  await ctx.reply('Введи название рейда (до 255 символов).', raidWizardCancelKb);
});

titleScene.on('text', async (ctx) => {
  try {
    const title = validateRaidTitle(ctx.message.text);
    const draft = ctx.scene.state as RaidDraft;
    draft.title = title;
    const next = RAID_CHAIN.nextOf(titleScene.id);
    if (next) {
      await ctx.scene.enter(next, draft as object);
    } else {
      await ctx.scene.leave();
    }
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
