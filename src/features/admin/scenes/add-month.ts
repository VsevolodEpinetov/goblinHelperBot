import { Scenes } from 'telegraf';

import { db } from '../../../db/client';
import { formatPeriod } from '../../../shared/period';
import { backToMonthsKeyboard } from '../menus';
import { insertMonth } from '../repo';
import { parsePeriodKey } from '../service';

export const ADD_MONTH_SCENE_ID = 'admin:add-month';
export const addMonthScene = new Scenes.BaseScene<Scenes.SceneContext>(ADD_MONTH_SCENE_ID);

addMonthScene.enter(async (ctx) => {
  await ctx.reply('Введи период (YYYY_MM), напр. `2026_06`. Или /cancel.', {
    parse_mode: 'Markdown',
  });
});

addMonthScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.', backToMonthsKeyboard());
});

addMonthScene.on('text', async (ctx) => {
  try {
    const { year, month } = parsePeriodKey(ctx.message.text);
    const period = formatPeriod({ year, month });
    const created: string[] = [];
    if (await insertMonth(db, period, 'regular', null)) created.push(`${period}/regular`);
    if (await insertMonth(db, period, 'plus', null)) created.push(`${period}/plus`);
    if (created.length === 0) {
      await ctx.reply(
        `📜 Месяц ${period} уже значится в архивах — ничего не менял.`,
        backToMonthsKeyboard(),
      );
    } else {
      await ctx.reply(
        `✅ Высек на камне: ${created.join(', ')}. Осталось привязать chat_id — это за кнопкой ниже.`,
        backToMonthsKeyboard(),
      );
    }
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
