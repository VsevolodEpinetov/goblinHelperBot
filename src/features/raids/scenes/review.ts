import type { Context } from 'telegraf';
import { Markup, Scenes } from 'telegraf';

import { editOrReply } from '../../../core/nav';
import { logger } from '../../../core/observability';
import { ensureApprovedMember } from '../../../core/permissions';
import { router } from '../../../core/router';
import { db } from '../../../db/client';
import { dispatchNotifications, grantXpInTrx } from '../../loyalty';
import { homeButton } from '../../onboarding/menus';
import { formatRaidMessage } from '../format';
import { capCaption, postRaidCard } from '../group-card';
import { createRaid } from '../repo';
import { RAID_CHAIN, type RaidDraft } from '../scene-chain';
import { raidsCallback } from '../schemas';
import { XP_FOR_CREATE } from '../service';

import { attachWizardCancel, RAID_WIZ_CANCEL } from './_cancel';

const REVIEW_BACK = 'raid:back';

const reviewKb = Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Создать', 'raid:confirm'),
    Markup.button.callback('❌ Отмена', RAID_WIZ_CANCEL),
  ],
  [Markup.button.callback('« Назад', REVIEW_BACK)],
]);

export const reviewScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:review');
attachWizardCancel(reviewScene);

reviewScene.enter(async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  const text = formatRaidMessage(
    {
      id: 0,
      title: draft.title ?? '',
      description: draft.description ?? null,
      link: draft.link ?? null,
      price: draft.price ?? 0,
      currency: draft.currency ?? 'RUB',
      status: 'open',
      createdBy: ctx.from.id,
      createdByUsername: ctx.from.username ?? null,
      createdByFirstName: ctx.from.first_name ?? null,
      createdByLastName: ctx.from.last_name ?? null,
      endDate: draft.endDate ? new Date(draft.endDate) : null,
    },
    [],
  );
  const photos = draft.photoFileIds ?? [];
  // Preview with the first photo, exactly like the group card will look.
  if (photos.length > 0 && photos[0]) {
    const note = photos.length > 1 ? `\n📷 Фото: ${photos.length} (на карточку пойдёт первое)` : '';
    await ctx.replyWithPhoto(photos[0], {
      caption: capCaption(text + note),
      parse_mode: 'HTML',
      ...reviewKb,
    });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', ...reviewKb });
  }
});

reviewScene.action(REVIEW_BACK, async (ctx) => {
  await ctx.answerCbQuery?.();
  const draft = ctx.scene.state as RaidDraft;
  const prev = RAID_CHAIN.prevOf('raid:review');
  if (prev) await ctx.scene.enter(prev, draft as object);
});

reviewScene.action('raid:confirm', async (ctx) => {
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  // Callbacks are replayable — re-check membership at the moment of creation,
  // not just at the wizard entry points.
  if (!(await ensureApprovedMember(ctx as unknown as Context))) {
    ctx.scene.state = {};
    await ctx.scene.leave();
    return;
  }
  const from = ctx.from;
  const draft = ctx.scene.state as RaidDraft;
  try {
    const result = await db.transaction(async (trx) => {
      const raidId = await createRaid(trx, {
        title: draft.title ?? '',
        description: draft.description ?? null,
        link: draft.link ?? null,
        price: draft.price ?? 0,
        currency: draft.currency ?? 'RUB',
        endDate: draft.endDate ? new Date(draft.endDate) : null,
        createdBy: from.id,
        createdByUsername: from.username ?? null,
        createdByFirstName: from.first_name ?? null,
        createdByLastName: from.last_name ?? null,
        photoFileIds: draft.photoFileIds ?? [],
      });
      const xp = await grantXpInTrx(trx, {
        userId: from.id,
        amount: XP_FOR_CREATE,
        source: 'raid_create',
        externalId: `raid:${raidId}`,
      });
      return { raidId, xp };
    });

    // Post the joinable card to the group raids topic OUTSIDE the transaction
    // (Telegram is non-transactional). postRaidCard stores the message id and
    // is a no-op when no group is configured.
    await postRaidCard(result.raidId);

    // Fire-and-forget notification of the XP gain / level-up.
    dispatchNotifications(from.id, result.xp, 'raid_create');
    await ctx.answerCbQuery?.();
    await editOrReply(
      ctx,
      `⚔️ Рейд #${result.raidId} выкинут на доску в логове — теперь гоблины видят его и могут вписаться.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🛡 Мои рейды', router.encode(raidsCallback, { a: 'raidMine' }))],
        [homeButton()],
      ]),
    );
  } catch (err) {
    logger.error({ err }, 'raid review confirm failed');
    await ctx.answerCbQuery?.();
    await editOrReply(
      ctx,
      '🕯 Рейд сорвался с лап — не вышло его затеять. Попробуй снова.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⚔️ Затеять снова',
            router.encode(raidsCallback, { a: 'raidCreate' }),
          ),
        ],
        [homeButton()],
      ]),
    );
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});
