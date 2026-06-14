import type { Context, Scenes } from 'telegraf';

import { editOrReply, homeKeyboard } from '../../core/nav';
import { logger } from '../../core/observability';
import { ensureApprovedMember, hasAdminRank } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { dispatchNotifications } from '../loyalty';

import { formatRaidMessage } from './format';
import { resyncRaidCard } from './group-card';
import {
  RAID_PAGE_SIZE,
  myRaidsKeyboard,
  raidConfirmKeyboard,
  raidListKeyboard,
  raidViewKeyboard,
} from './menus';
import {
  getRaidById,
  getRaidParticipants,
  listRaids,
  listRaidsByCreator,
  listRaidsForParticipant,
} from './repo';
import { RAID_CHAIN } from './scene-chain';
import { raidsCallback } from './schemas';
import { cancelRaid, closeRaid, completeRaid, joinRaidAndAward, leaveRaidAtomic } from './service';

/**
 * Refresh the raid card the user actually tapped, when it's the in-DM raidView
 * card (text). Taps on the group topic card are handled by resyncRaidCard, which
 * deletes+reposts that message — so we skip the in-place edit there.
 */
async function refreshDmRaidCard(ctx: Context, raidId: number): Promise<void> {
  if (ctx.chat?.type !== 'private' || !ctx.from) return;
  const raid = await getRaidById(db, raidId);
  if (!raid) return;
  const participants = await getRaidParticipants(db, raidId);
  try {
    await ctx.editMessageText(formatRaidMessage(raid, participants), {
      parse_mode: 'HTML',
      ...raidViewKeyboard(
        raid,
        raid.createdBy === ctx.from.id,
        hasAdminRank(ctx.state.roles ?? []),
      ),
    });
  } catch (err) {
    logger.debug({ err, raidId }, 'refreshDmRaidCard: edit failed');
  }
}

/** One page of «my raids»; shared by the raidMine callback and /myraids. */
export async function renderMyRaids(ctx: Context, page: number): Promise<void> {
  if (!ctx.from) return;
  const created = await listRaidsByCreator(db, ctx.from.id);
  const joined = await listRaidsForParticipant(db, ctx.from.id);
  const seen = new Set<number>();
  const mine = [...created, ...joined].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  const hasNext = mine.length > (page + 1) * RAID_PAGE_SIZE;
  const pageRows = mine.slice(page * RAID_PAGE_SIZE, (page + 1) * RAID_PAGE_SIZE);
  const header =
    mine.length === 0
      ? '🌑 Своих рейдов у тебя пока нет, свой.'
      : '🛡 Твои рейды — что затеял или к чему примкнул:';
  await editOrReply(ctx, header, myRaidsKeyboard(pageRows, page, hasNext));
}

/**
 * One raid's full card with status-appropriate actions + nav. Shared by
 * /raidinfo and the raid_<id> deep link from the group topic card.
 */
export async function renderRaidCard(ctx: Context, raidId: number): Promise<void> {
  if (!ctx.from) return;
  const raid = await getRaidById(db, raidId);
  if (!raid) {
    await ctx.reply(
      '🌑 Этого рейда уже нет — закрыли или сожгли, следов не осталось.',
      homeKeyboard(),
    );
    return;
  }
  const participants = await getRaidParticipants(db, raidId);
  await ctx.reply(formatRaidMessage(raid, participants), {
    parse_mode: 'HTML',
    ...raidViewKeyboard(raid, raid.createdBy === ctx.from.id, hasAdminRank(ctx.state.roles ?? [])),
  });
}

/** One page of the open-raids screen; shared by the raidList callback and /raids. */
export async function renderOpenRaids(ctx: Context, page: number): Promise<void> {
  const rows = await listRaids(db, {
    status: 'open',
    limit: RAID_PAGE_SIZE + 1,
    offset: page * RAID_PAGE_SIZE,
  });
  const hasNext = rows.length > RAID_PAGE_SIZE;
  const pageRows = rows.slice(0, RAID_PAGE_SIZE);
  const header =
    pageRows.length === 0
      ? '🌑 Открытых рейдов сейчас нет — никто в поход не скликает. Загляни позже.'
      : '⚔️ Открытые рейды — тыкни любой, покажу, что к чему.';
  await editOrReply(ctx, header, raidListKeyboard(pageRows, page, hasNext));
}

export function registerRaidActions(): void {
  router.on(raidsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }

    switch (payload.a) {
      case 'raidList': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await renderOpenRaids(ctx as unknown as Context, payload.p ?? 0);
        await ctx.answerCbQuery?.();
        break;
      }
      case 'raidView': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const raid = await getRaidById(db, payload.id);
        if (!raid) {
          await ctx.answerCbQuery?.('Рейд не найден');
          return;
        }
        const participants = await getRaidParticipants(db, raid.id);
        const text = formatRaidMessage(raid, participants);
        const isCreator = raid.createdBy === ctx.from.id;
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          ...raidViewKeyboard(raid, isCreator, hasAdminRank(ctx.state.roles ?? [])),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'raidCreate': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await ctx.answerCbQuery?.();
        // Drop the list buttons so they don't linger live above the wizard prompt.
        try {
          await ctx.editMessageReplyMarkup(undefined);
        } catch {
          /* uneditable; ignore */
        }
        await (ctx as unknown as Scenes.SceneContext).scene.enter(RAID_CHAIN.steps[0]!);
        break;
      }
      case 'raidMine': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await renderMyRaids(ctx as unknown as Context, payload.p ?? 0);
        await ctx.answerCbQuery?.();
        break;
      }
      case 'raidJoin': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const { result, xp } = await joinRaidAndAward(payload.id, {
          userId: ctx.from.id,
          username: ctx.from.username ?? null,
          firstName: ctx.from.first_name ?? null,
          lastName: ctx.from.last_name ?? null,
        });
        if (xp) dispatchNotifications(ctx.from.id, xp, 'raid_join');
        await ctx.answerCbQuery?.(result === 'joined' ? '⚔️ Ты в рейде!' : 'Ты уже в этом рейде');
        await refreshDmRaidCard(ctx as unknown as Context, payload.id);
        await resyncRaidCard(payload.id);
        break;
      }
      case 'raidLeave': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const result = await leaveRaidAtomic(payload.id, ctx.from.id);
        await ctx.answerCbQuery?.(
          result === 'left' ? 'Вышел из рейда. Бывает.' : 'Тебя нет в этом рейде',
        );
        await refreshDmRaidCard(ctx as unknown as Context, payload.id);
        await resyncRaidCard(payload.id);
        break;
      }
      case 'raidCompleteAsk':
      case 'raidCancelAsk': {
        const raid = await getRaidById(db, payload.id);
        const staffCancel = payload.a === 'raidCancelAsk' && hasAdminRank(ctx.state.roles ?? []);
        if (!raid || (raid.createdBy !== ctx.from.id && !staffCancel)) {
          await ctx.answerCbQuery?.('Нельзя');
          return;
        }
        const isComplete = payload.a === 'raidCompleteAsk';
        await ctx.editMessageText(
          isComplete
            ? '🔥 Отметить рейд как завершённый? Решение окончательное и повернуть назад нельзя будет. '
            : '💀 Сжечь все записи о неудачном рейде? Прям насовсем? Из огня вытаскивать свитки не буду. ',
          { ...raidConfirmKeyboard(payload.id, isComplete ? 'raidComplete' : 'raidCancel') },
        );
        await ctx.answerCbQuery?.();
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
        await refreshDmRaidCard(ctx as unknown as Context, payload.id);
        await resyncRaidCard(payload.id);
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
          dispatchNotifications(after.raid.createdBy, after.xp, 'raid_complete');
        }
        await ctx.answerCbQuery?.('Завершён');
        await refreshDmRaidCard(ctx as unknown as Context, payload.id);
        await resyncRaidCard(payload.id);
        break;
      }
      case 'raidCancel': {
        const raid = await getRaidById(db, payload.id);
        if (!raid || (raid.createdBy !== ctx.from.id && !hasAdminRank(ctx.state.roles ?? []))) {
          await ctx.answerCbQuery?.('Нельзя');
          return;
        }
        await cancelRaid(payload.id);
        await ctx.answerCbQuery?.('Отменён');
        await refreshDmRaidCard(ctx as unknown as Context, payload.id);
        await resyncRaidCard(payload.id);
        break;
      }
    }
  });
}
