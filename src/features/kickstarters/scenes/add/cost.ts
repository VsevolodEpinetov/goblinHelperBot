import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { starsPriceHint } from '../../constants';
import { validateCost } from '../../service';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { cancelKb, KS_ADD_CANCEL } from './_nav';

export const costScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:cost');

costScene.enter(async (ctx) => {
  await ctx.reply(`Цена в звёздах?\n\n${starsPriceHint()}`, cancelKb());
});

registerCancel(costScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

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
