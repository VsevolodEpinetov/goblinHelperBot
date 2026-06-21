import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { doneCancelKb, KS_ADD_CANCEL, KS_ADD_DONE } from './_nav';

export const photosScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:photos');

async function finish(ctx: Scenes.SceneContext): Promise<void> {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds || draft.photoFileIds.length === 0) {
    await ctx.reply('Нужно хотя бы одно фото.', doneCancelKb());
    return;
  }
  const next = KS_ADD_CHAIN.nextOf(photosScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
}

photosScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  await ctx.reply(
    'Пришли фото кикстартера — можно несколько разом. Жми «Готово», когда всё.',
    doneCancelKb(),
  );
});

registerCancel(photosScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

photosScene.on('photo', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  const largest = ctx.message.photo[ctx.message.photo.length - 1];
  if (largest) draft.photoFileIds.push(largest.file_id);
  await ctx.reply(
    `Фото сохранено (${draft.photoFileIds.length}). Ещё или «Готово».`,
    doneCancelKb(),
  );
});

photosScene.action(KS_ADD_DONE, async (ctx) => {
  await ctx.answerCbQuery?.();
  await finish(ctx);
});

photosScene.hears(/^(готово|далее)$/i, async (ctx) => {
  await finish(ctx);
});

photosScene.on('text', async (ctx) => {
  await ctx.reply('Пришли фото или жми «Готово».', doneCancelKb());
});
