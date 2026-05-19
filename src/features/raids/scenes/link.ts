import { Scenes } from 'telegraf';

import { RAID_CHAIN, type RaidDraft } from '../scene-chain';

export const linkScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:link');

linkScene.enter(async (ctx) => {
  await ctx.reply('Ссылка на товар? Можно "пропустить", если нет.');
});

linkScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

linkScene.on('text', async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  const text = ctx.message.text.trim();
  draft.link = /^пропустить$/i.test(text) ? null : text;
  const next = RAID_CHAIN.nextOf('raid:link');
  if (next) await ctx.scene.enter(next, draft as object);
  else await ctx.scene.leave();
});
