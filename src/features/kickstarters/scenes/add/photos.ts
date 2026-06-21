import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { cancelKb, KS_ADD_CANCEL } from './_nav';

export const photosScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:photos');

photosScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  // One photo only — the group promo carries it with the inline buy button,
  // and a media group can't hold buttons. (Sending several at once keeps just
  // the first; the rest arrive after we've moved on and are ignored.)
  await ctx.reply('Пришли одно фото кикстартера.', cancelKb());
});

registerCancel(photosScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

photosScene.on('photo', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  const largest = ctx.message.photo[ctx.message.photo.length - 1];
  if (!largest) return;
  draft.photoFileIds = [largest.file_id];
  const next = KS_ADD_CHAIN.nextOf(photosScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});

photosScene.on('text', async (ctx) => {
  await ctx.reply('Пришли одно фото (картинкой).', cancelKb());
});
