import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { validateCost } from '../../service';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const pledgeCostScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:pledge-cost');

pledgeCostScene.enter(async (ctx) => {
  await ctx.reply('Цена пледжа? "пропустить" если нет. Или /cancel.');
});

registerCancel(pledgeCostScene, { text: 'Отменено.' });

pledgeCostScene.on('text', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  const text = ctx.message.text.trim();
  if (/^пропустить$/i.test(text)) {
    draft.pledgeCost = null;
    const next = KS_ADD_CHAIN.nextOf(pledgeCostScene.id);
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
    return;
  }
  try {
    draft.pledgeCost = validateCost(text);
    const next = KS_ADD_CHAIN.nextOf(pledgeCostScene.id);
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
