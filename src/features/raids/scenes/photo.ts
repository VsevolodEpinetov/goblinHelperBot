import { Markup, Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';

import { attachWizardCancel, wizardCancelRow } from './_cancel';

const PHOTO_NEXT = 'raid:photo:next';

const photoControlsKb = Markup.inlineKeyboard([
  [Markup.button.callback('Далее »', PHOTO_NEXT)],
  wizardCancelRow(),
]);

export const photoScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:photo');
attachWizardCancel(photoScene);

photoScene.enter(async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  await ctx.reply(
    'Кидай фото для рейда — одно или несколько, по одному. Как закончишь — жми «Далее».',
    photoControlsKb,
  );
});

photoScene.on('photo', async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!draft.photoFileIds) draft.photoFileIds = [];
  const largest = ctx.message.photo[ctx.message.photo.length - 1];
  if (largest) draft.photoFileIds.push(largest.file_id);
  await ctx.reply(
    `Фото припрятал (${draft.photoFileIds.length}). Кидай ещё или жми «Далее».`,
    photoControlsKb,
  );
});

async function advanceFromPhoto(ctx: Scenes.SceneContext): Promise<boolean> {
  const draft = ctx.scene.state as RaidDraft;
  if (!draft.photoFileIds || draft.photoFileIds.length === 0) return false;
  const next = RAID_CHAIN.nextOf('raid:photo');
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
  return true;
}

photoScene.action(PHOTO_NEXT, async (ctx) => {
  await ctx.answerCbQuery?.();
  if (!(await advanceFromPhoto(ctx))) {
    await ctx.reply('Сперва кинь хоть одно фото — без картинки рейд не рейд.', photoControlsKb);
  }
});

photoScene.hears(/^\s*далее\s*$/i, async (ctx) => {
  if (!(await advanceFromPhoto(ctx))) {
    await ctx.reply('Сперва кинь хоть одно фото — без картинки рейд не рейд.', photoControlsKb);
  }
});

photoScene.on('text', async (ctx) => {
  await ctx.reply('Кидай фото или жми «Далее», когда закончишь.', photoControlsKb);
});
