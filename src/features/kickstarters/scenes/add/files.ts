import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { doneCancelKb, KS_ADD_CANCEL, KS_ADD_DONE } from './_nav';

export const filesScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:files');

async function finish(ctx: Scenes.SceneContext): Promise<void> {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.fileFileIds) draft.fileFileIds = [];
  const next = KS_ADD_CHAIN.nextOf(filesScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
}

filesScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.fileFileIds) draft.fileFileIds = [];
  await ctx.reply(
    'Пришли файлы кикстартера — можно несколько разом. Жми «Готово», когда всё (можно и без файлов).',
    doneCancelKb(),
  );
});

registerCancel(filesScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

filesScene.on('document', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  if (!draft.fileFileIds) draft.fileFileIds = [];
  draft.fileFileIds.push(ctx.message.document.file_id);
  await ctx.reply(`Файл сохранён (${draft.fileFileIds.length}). Ещё или «Готово».`, doneCancelKb());
});

filesScene.action(KS_ADD_DONE, async (ctx) => {
  await ctx.answerCbQuery?.();
  await finish(ctx);
});

filesScene.hears(/^(готово|далее)$/i, async (ctx) => {
  await finish(ctx);
});

filesScene.on('text', async (ctx) => {
  await ctx.reply('Пришли файл (можно несколько) или жми «Готово».', doneCancelKb());
});
