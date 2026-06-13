import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const pledgeNameScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:pledge-name');

pledgeNameScene.enter(async (ctx) => {
  await ctx.reply('Имя пледжа? "пропустить" если нет. Или /cancel.');
});

registerCancel(pledgeNameScene, { text: 'Отменено.' });

pledgeNameScene.on('text', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  const text = ctx.message.text.trim();
  draft.pledgeName = /^пропустить$/i.test(text) ? null : text;
  const next = KS_ADD_CHAIN.nextOf(pledgeNameScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});
