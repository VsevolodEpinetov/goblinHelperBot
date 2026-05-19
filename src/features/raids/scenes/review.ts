import { Markup, Scenes } from 'telegraf';

import { logger } from '../../../core/observability';
import { db } from '../../../db/client';
import { dispatchNotifications, grantXpInTrx } from '../../loyalty';
import { formatRaidMessage } from '../format';
import { publicRaidKeyboard } from '../menus';
import { createRaid, updateRaidPublicMessage } from '../repo';
import type { RaidDraft } from '../scene-chain';
import { XP_FOR_CREATE } from '../service';

export const reviewScene = new Scenes.BaseScene<Scenes.SceneContext>('raid:review');

reviewScene.enter(async (ctx) => {
  const draft = ctx.scene.state as RaidDraft;
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(
    formatRaidMessage(
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
    ),
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Создать', 'raid:confirm'),
          Markup.button.callback('❌ Отмена', 'raid:abort'),
        ],
      ]),
    },
  );
});

reviewScene.action('raid:abort', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText('Отменено.');
});

reviewScene.action('raid:confirm', async (ctx) => {
  if (!ctx.from) {
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

    // Post the public message OUTSIDE the transaction (Telegram is non-transactional).
    if (ctx.chat) {
      const msg = await ctx.telegram.sendMessage(
        ctx.chat.id,
        formatRaidMessage(
          {
            id: result.raidId,
            title: draft.title ?? '',
            description: draft.description ?? null,
            link: draft.link ?? null,
            price: draft.price ?? 0,
            currency: draft.currency ?? 'RUB',
            status: 'open',
            createdBy: from.id,
            createdByUsername: from.username ?? null,
            createdByFirstName: from.first_name ?? null,
            createdByLastName: from.last_name ?? null,
            endDate: draft.endDate ? new Date(draft.endDate) : null,
          },
          [],
        ),
        {
          parse_mode: 'HTML',
          ...publicRaidKeyboard({ id: result.raidId, status: 'open' }),
        },
      );
      await updateRaidPublicMessage(db, result.raidId, String(ctx.chat.id), String(msg.message_id));
    }

    // Fire-and-forget notification of the XP gain / level-up.
    dispatchNotifications(from.id, result.xp, 'raid_create');
    await ctx.editMessageText(`Рейд #${result.raidId} создан.`);
  } catch (err) {
    logger.error({ err }, 'raid review confirm failed');
    await ctx.editMessageText('Не удалось создать рейд. Попробуй ещё раз.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});
