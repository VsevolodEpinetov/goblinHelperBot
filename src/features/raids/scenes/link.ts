import { Markup, Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';

import { attachWizardCancel, wizardCancelRow } from './_cancel';

const LINK_SKIP = 'raid:link:skip';

const linkControlsKb = Markup.inlineKeyboard([
  [Markup.button.callback('Пропустить »', LINK_SKIP)],
  wizardCancelRow(),
]);

export const linkScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:link');
attachWizardCancel(linkScene);

linkScene.enter(async (ctx) => {
  await ctx.reply('Кидай ссылку на товар. Нет ссылки — жми «Пропустить».', linkControlsKb);
});

async function advanceFromLink(ctx: Scenes.SceneContext, link: string | null): Promise<void> {
  const draft = ctx.scene.state as RaidDraft;
  draft.link = link;
  const next = RAID_CHAIN.nextOf('raid:link');
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
}

linkScene.action(LINK_SKIP, async (ctx) => {
  await ctx.answerCbQuery?.();
  await advanceFromLink(ctx, null);
});

linkScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  await advanceFromLink(ctx, /^пропустить$/i.test(text) ? null : text);
});
