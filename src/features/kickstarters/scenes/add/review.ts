import { Markup, Scenes } from 'telegraf';

import { logger } from '../../../../core/observability';
import { db } from '../../../../db/client';
import { createKickstarter } from '../../repo';
import type { KsAddDraft } from '../add-chain';

export const reviewScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:review');

reviewScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  await ctx.reply(
    `<b>${draft.name ?? ''}</b>\n` +
      `Автор: ${draft.creator ?? '—'}\n` +
      `Цена: ${draft.cost ?? 0} ⭐\n` +
      `Pledge: ${draft.pledgeName ?? '—'} (${draft.pledgeCost ?? '—'} ⭐)\n` +
      `Фото: ${draft.photoFileIds?.length ?? 0}, файлов: ${draft.fileFileIds?.length ?? 0}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Создать', 'ks:add:confirm'),
          Markup.button.callback('❌ Отмена', 'ks:add:abort'),
        ],
      ]),
    },
  );
});

reviewScene.action('ks:add:abort', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText('Отменено.');
});

reviewScene.action('ks:add:confirm', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  try {
    const id = await db.transaction((trx) =>
      createKickstarter(trx, {
        name: draft.name ?? '',
        creator: draft.creator ?? null,
        cost: draft.cost ?? 0,
        pledgeName: draft.pledgeName ?? null,
        pledgeCost: draft.pledgeCost ?? null,
        link: draft.link ?? null,
        photoFileIds: draft.photoFileIds ?? [],
        fileFileIds: draft.fileFileIds ?? [],
      }),
    );
    await ctx.editMessageText(`Создан кикстартер #${id}.`);
  } catch (err) {
    logger.error({ err }, 'kickstarter add: createKickstarter failed');
    await ctx.editMessageText('Не удалось создать. Попробуй ещё раз.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});
