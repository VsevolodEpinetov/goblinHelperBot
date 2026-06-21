import { Markup, Scenes } from 'telegraf';

import { logger } from '../../../../core/observability';
import { router } from '../../../../core/router';
import { registerCancel } from '../../../../core/scenes';
import { db } from '../../../../db/client';
import { escapeHtml } from '../../../../shared/format';
import { postKickstarterPromo } from '../../promo';
import { createKickstarter } from '../../repo';
import { ksCallback } from '../../schemas';
import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';

const REVIEW_BACK = 'ks:add:back';

export const reviewScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:review');

reviewScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  await ctx.reply(
    `<b>${escapeHtml(draft.name ?? '')}</b>\n` +
      `Автор: ${escapeHtml(draft.creator ?? '—')}\n` +
      `Цена: ${draft.cost ?? 0} ⭐\n` +
      `Pledge: ${escapeHtml(draft.pledgeName ?? '—')} (${draft.pledgeCost ?? '—'} ⭐)\n` +
      `Фото: ${draft.photoFileIds?.length ?? 0}, файлов: ${draft.fileFileIds?.length ?? 0}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Создать', 'ks:add:confirm'),
          Markup.button.callback('❌ Отмена', 'ks:add:abort'),
        ],
        [Markup.button.callback('« Назад', REVIEW_BACK)],
      ]),
    },
  );
});

registerCancel(reviewScene, { text: 'Отменено.', action: 'ks:add:abort' });

reviewScene.action(REVIEW_BACK, async (ctx) => {
  await ctx.answerCbQuery?.();
  const draft = ctx.scene.state as KsAddDraft;
  const prev = KS_ADD_CHAIN.prevOf('ks:add:review');
  if (prev) await ctx.scene.enter(prev, draft as object);
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
    // Announce in the group topic OUTSIDE the transaction (Telegram is
    // non-transactional); no-op when no group is configured.
    await postKickstarterPromo(id);
    await ctx.editMessageText(
      `Создан кикстартер #${id}.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✏️ Редактировать',
            router.encode(ksCallback, { a: 'ksAdminMenu', id }),
          ),
          Markup.button.callback('🎯 Карточка', router.encode(ksCallback, { a: 'ksView', id })),
        ],
      ]),
    );
  } catch (err) {
    logger.error({ err }, 'kickstarter add: createKickstarter failed');
    await ctx.editMessageText(
      'Не удалось создать. Попробуй ещё раз.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Попробовать снова', router.encode(ksCallback, { a: 'ksAdd' }))],
      ]),
    );
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});
