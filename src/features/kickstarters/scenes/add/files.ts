import { Scenes } from 'telegraf';

import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const filesScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:files');

filesScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.fileFileIds) draft.fileFileIds = [];
  await ctx.reply(
    'Отправь файлы для кикстартера (по одному). Когда закончишь — напиши "далее". Можно без файлов.',
  );
});

filesScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

filesScene.on('document', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.fileFileIds) draft.fileFileIds = [];
  draft.fileFileIds.push(ctx.message.document.file_id);
  await ctx.reply(`Файл сохранён (${draft.fileFileIds.length}). Ещё один или "далее".`);
});

filesScene.hears(/^далее$/i, async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.fileFileIds) draft.fileFileIds = [];
  const next = KS_ADD_CHAIN.nextOf(filesScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});

filesScene.on('text', async (ctx) => {
  await ctx.reply('Отправь документ или напиши "далее" когда закончишь.');
});
