import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';

export const photoScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:photo');

photoScene.enter(async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  await ctx.reply(
    'Отправь одно или несколько фото для рейда (по одному). Когда закончишь — напиши "далее".',
  );
});

photoScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

photoScene.on('photo', async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  const largest = ctx.message.photo[ctx.message.photo.length - 1];
  if (largest) draft.photoFileIds.push(largest.file_id);
  await ctx.reply(`Фото сохранено (${draft.photoFileIds.length}). Ещё одно или "далее".`);
});

photoScene.hears(/^далее$/i, async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!draft.photoFileIds || draft.photoFileIds.length === 0) {
    await ctx.reply('Нужно хотя бы одно фото.');
    return;
  }
  const next = RAID_CHAIN.nextOf('raid:photo');
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});

photoScene.on('text', async (ctx) => {
  await ctx.reply('Отправь фото или напиши "далее" когда закончишь.');
});
