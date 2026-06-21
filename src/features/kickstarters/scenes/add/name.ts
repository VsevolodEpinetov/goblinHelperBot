import { Scenes } from 'telegraf';

import { registerCancel } from '../../../../core/scenes';
import { validateName } from '../../service';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

import { cancelKb, KS_ADD_CANCEL } from './_nav';

export const nameScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:name');

nameScene.enter(async (ctx) => {
  await ctx.reply('Имя нового кикстартера?', cancelKb());
});

registerCancel(nameScene, { text: 'Отменено.', action: KS_ADD_CANCEL });

nameScene.on('text', async (ctx) => {
  try {
    const name = validateName(ctx.message.text);
    const draft = ctx.scene.state as KsAddDraft;
    draft.name = name;
    const next = KS_ADD_CHAIN.nextOf(nameScene.id);
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
