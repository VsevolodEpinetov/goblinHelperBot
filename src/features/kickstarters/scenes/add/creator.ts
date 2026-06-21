import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { KS_ADD_CANCEL, KS_ADD_SKIP, skipCancelKb } from './_nav';

export const creatorScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:creator');

async function advance(ctx: Scenes.SceneContext, creator: string | null): Promise<void> {
  const draft = ctx.scene.state as KsAddDraft;
  draft.creator = creator;
  const next = KS_ADD_CHAIN.nextOf(creatorScene.id);
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
}

creatorScene.enter(async (ctx) => {
  await ctx.reply('Автор кикстартера?', skipCancelKb());
});

registerCancel(creatorScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

creatorScene.action(KS_ADD_SKIP, async (ctx) => {
  await ctx.answerCbQuery?.();
  await advance(ctx, null);
});

creatorScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  await advance(ctx, /^пропустить$/i.test(text) ? null : text);
});
