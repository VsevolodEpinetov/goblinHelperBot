import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { validateLink } from '../../service';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

export const linkScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:link');

linkScene.enter(async (ctx) => {
  await ctx.reply('Ссылка? "пропустить" если нет. Или /cancel.');
});

registerCancel(linkScene, { text: 'Отменено.' });

linkScene.on('text', async (ctx) => {
  try {
    const link = validateLink(ctx.message.text);
    const draft = ctx.scene.state as KsAddDraft;
    draft.link = link;
    const next = KS_ADD_CHAIN.nextOf(linkScene.id);
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
