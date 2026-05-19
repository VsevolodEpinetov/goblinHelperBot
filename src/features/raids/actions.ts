import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { dispatchNotifications } from '../loyalty';

import { formatRaidMessage } from './format';
import { creatorControlsKeyboard, publicRaidKeyboard } from './menus';
import { getRaidById, getRaidParticipants } from './repo';
import { raidsCallback } from './schemas';
import { cancelRaid, closeRaid, completeRaid, joinRaidAndAward, leaveRaidAtomic } from './service';

async function updatePublicMessage(raidId: number): Promise<void> {
  const raid = await getRaidById(db, raidId);
  if (!raid || !raid.chatId || !raid.messageId) return;
  const participants = await getRaidParticipants(db, raidId);
  try {
    await bot.telegram.editMessageText(
      raid.chatId,
      Number(raid.messageId),
      undefined,
      formatRaidMessage(raid, participants),
      {
        parse_mode: 'HTML',
        ...publicRaidKeyboard({ id: raid.id, status: raid.status }),
      },
    );
  } catch (err) {
    logger.warn({ err, raidId }, 'updatePublicMessage: edit failed');
  }
}

export function registerRaidActions(): void {
  router.on(raidsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }

    switch (payload.a) {
      case 'raidView': {
        const raid = await getRaidById(db, payload.id);
        if (!raid) {
          await ctx.answerCbQuery?.('Рейд не найден');
          return;
        }
        const participants = await getRaidParticipants(db, raid.id);
        const text = formatRaidMessage(raid, participants);
        const isCreator = raid.createdBy === ctx.from.id;
        await ctx.reply(text, {
          parse_mode: 'HTML',
          ...(isCreator ? creatorControlsKeyboard(raid) : publicRaidKeyboard(raid)),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'raidJoin': {
        const result = await joinRaidAndAward(payload.id, {
          userId: ctx.from.id,
          username: ctx.from.username ?? null,
          firstName: ctx.from.first_name ?? null,
          lastName: ctx.from.last_name ?? null,
        });
        await ctx.answerCbQuery?.(result === 'joined' ? 'Присоединились' : 'Уже в рейде');
        await updatePublicMessage(payload.id);
        break;
      }
      case 'raidLeave': {
        const result = await leaveRaidAtomic(payload.id, ctx.from.id);
        await ctx.answerCbQuery?.(result === 'left' ? 'Вышли' : 'Тебя нет в этом рейде');
        await updatePublicMessage(payload.id);
        break;
      }
      case 'raidClose': {
        const raid = await getRaidById(db, payload.id);
        if (!raid || raid.createdBy !== ctx.from.id) {
          await ctx.answerCbQuery?.('Нельзя');
          return;
        }
        await closeRaid(payload.id);
        await ctx.answerCbQuery?.('Закрыт');
        await updatePublicMessage(payload.id);
        break;
      }
      case 'raidComplete': {
        const raid = await getRaidById(db, payload.id);
        if (!raid || raid.createdBy !== ctx.from.id) {
          await ctx.answerCbQuery?.('Нельзя');
          return;
        }
        const after = await completeRaid(payload.id);
        if (after) {
          dispatchNotifications(
            after.createdBy,
            { applied: true, totalXp: 0, tier: '', level: 0, levelUp: null },
            'raid_complete',
          );
        }
        await ctx.answerCbQuery?.('Завершён');
        await updatePublicMessage(payload.id);
        break;
      }
      case 'raidCancel': {
        const raid = await getRaidById(db, payload.id);
        if (!raid || raid.createdBy !== ctx.from.id) {
          await ctx.answerCbQuery?.('Нельзя');
          return;
        }
        await cancelRaid(payload.id);
        await ctx.answerCbQuery?.('Отменён');
        await updatePublicMessage(payload.id);
        break;
      }
    }
  });
}
