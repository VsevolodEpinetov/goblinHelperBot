import { Scenes } from 'telegraf';

import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const photosScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:photos');

photosScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  await ctx.reply(
    'Отправь одно или несколько фото для кикстартера (по одному). Когда закончишь — напиши "далее".',
  );
});

photosScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

photosScene.on('photo', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  const largest = ctx.message.photo[ctx.message.photo.length - 1];
  if (largest) draft.photoFileIds.push(largest.file_id);
  await ctx.reply(`Фото сохранено (${draft.photoFileIds.length}). Ещё одно или "далее".`);
});

photosScene.hears(/^далее$/i, async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds || draft.photoFileIds.length === 0) {
    await ctx.reply('Нужно хотя бы одно фото.');
    return;
  }
  const next = KS_ADD_CHAIN.nextOf(photosScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});

photosScene.on('text', async (ctx) => {
  await ctx.reply('Отправь фото или напиши "далее" когда закончишь.');
});
