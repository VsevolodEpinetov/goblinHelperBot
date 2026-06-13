import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { validateCost } from '../../service';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const costScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:cost');

costScene.enter(async (ctx) => {
  await ctx.reply('Цена в звёздах? Или /cancel.');
});

registerCancel(costScene, { text: 'Отменено.' });

costScene.on('text', async (ctx) => {
  try {
    const cost = validateCost(ctx.message.text);
    const draft = ctx.scene.state as KsAddDraft;
    draft.cost = cost;
    const next = KS_ADD_CHAIN.nextOf(costScene.id);
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
