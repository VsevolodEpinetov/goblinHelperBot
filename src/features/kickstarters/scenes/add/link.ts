import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { validateLink } from '../../service';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { KS_ADD_CANCEL, KS_ADD_SKIP, skipCancelKb } from './_nav';

export const linkScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:link');

async function advance(ctx: Scenes.SceneContext, link: string | null): Promise<void> {
  const draft = ctx.scene.state as KsAddDraft;
  draft.link = link;
  const next = KS_ADD_CHAIN.nextOf(linkScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
}

linkScene.enter(async (ctx) => {
  await ctx.reply('Ссылка на кикстартер?', skipCancelKb());
});

registerCancel(linkScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

linkScene.action(KS_ADD_SKIP, async (ctx) => {
  await ctx.answerCbQuery?.();
  await advance(ctx, null);
});

linkScene.on('text', async (ctx) => {
  try {
    await advance(ctx, validateLink(ctx.message.text));
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
