import { Scenes } from 'telegraf';

import { db } from '../../../db/client';
import { formatPeriod } from '../../../shared/period';
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
  await ctx.reply('Отменено.');
});

addMonthScene.on('text', async (ctx) => {
  try {
    const { year, month } = parsePeriodKey(ctx.message.text);
    const period = formatPeriod({ year, month });
    await insertMonth(db, period, 'regular', null);
    await insertMonth(db, period, 'plus', null);
    await ctx.reply(
      `✅ Добавлены ${period}/regular и ${period}/plus. Установи chat_id командой /admin → Months.`,
    );
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
