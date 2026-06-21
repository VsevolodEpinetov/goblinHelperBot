import { Markup, Scenes } from 'telegraf';

import { router } from '../../../core/router';
import { registerCancel } from '../../../core/scenes';
import { db } from '../../../db/client';
import { ksSearchResultsKeyboard } from '../menus';
import { listUserKickstarters, searchKickstarters } from '../repo';
import { ksCallback } from '../schemas';

export const KS_SEARCH_SCENE_ID = 'ks:search';
const KS_SEARCH_CANCEL = 'ks:search:cancel';

const cancelKb = Markup.inlineKeyboard([[Markup.button.callback('« Отмена', KS_SEARCH_CANCEL)]]);
const backToCatalogue = Markup.inlineKeyboard([
  [Markup.button.callback('« К каталогу', router.encode(ksCallback, { a: 'ksList' }))],
]);

export const ksSearchScene = new Scenes.BaseScene<Scenes.SceneContext>(KS_SEARCH_SCENE_ID);

ksSearchScene.enter(async (ctx) => {
  await ctx.reply('🔍 Что ищем? Напиши часть названия кикстартера.', cancelKb);
});

registerCancel(ksSearchScene, {
  text: '🕯 Поиск свёрнут.',
  extra: backToCatalogue,
  action: KS_SEARCH_CANCEL,
});

ksSearchScene.on('text', async (ctx) => {
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  const query = ctx.message.text.trim();
  if (query.length < 2) {
    await ctx.reply('Дай хотя бы пару букв.', cancelKb);
    return; // stay in scene to retry
  }
  const [rows, mine] = await Promise.all([
    searchKickstarters(db, query, 20),
    listUserKickstarters(db, ctx.from.id),
  ]);
  if (rows.length === 0) {
    await ctx.reply('🌑 По такому запросу ничего нет. Попробуй иначе.', cancelKb);
    return; // stay in scene to retry
  }
  const ownedIds = new Set(mine.map((k) => k.id));
  await ctx.scene.leave();
  await ctx.reply(`🔍 Нашёл: ${rows.length}`, ksSearchResultsKeyboard(rows, ownedIds));
});
