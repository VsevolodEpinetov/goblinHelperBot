import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const creatorScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:creator');

creatorScene.enter(async (ctx) => {
  await ctx.reply('Автор? "пропустить" если нет. Или /cancel.');
});

registerCancel(creatorScene, { text: 'Отменено.' });

creatorScene.on('text', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  const text = ctx.message.text.trim();
  draft.creator = /^пропустить$/i.test(text) ? null : text;
  const next = KS_ADD_CHAIN.nextOf(creatorScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});
