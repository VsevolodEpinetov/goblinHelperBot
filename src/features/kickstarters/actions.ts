import type { Context, Scenes } from 'telegraf';

import { answerThenEdit, editOrReply } from '../../core/nav';
import { logger } from '../../core/observability';
import { ensureApprovedMember, hasAdminRank } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { getScrollBalance } from '../scrolls';

import { formatKickstarterCard } from './format';
import {
  adminEditKeyboard,
  catalogKeyboard,
  DEFAULT_SCROLL_ID,
  myKickstartersKeyboard,
  scrollConfirmKeyboard,
  userViewKeyboard,
} from './menus';
import {
  getKickstarterById,
  hasUserPurchased,
  listKickstarters,
  listUserKickstarters,
} from './repo';
import { ksCallback } from './schemas';
import { purchaseWithScroll } from './service';

const EDIT_SCENE_ID: Record<string, string> = {
  name: 'ks:edit:name',
  creator: 'ks:edit:creator',
  cost: 'ks:edit:cost',
  link: 'ks:edit:link',
  pledge_name: 'ks:edit:pledge_name',
  pledge_cost: 'ks:edit:pledge_cost',
};

/** The kickstarter catalogue screen; shared by the ksList callback and /kickstarters. */
export async function renderKsCatalog(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const [rows, mine] = await Promise.all([
    listKickstarters(db),
    listUserKickstarters(db, ctx.from.id),
  ]);
  const ownedIds = new Set(mine.map((ks) => ks.id));
  const header =
    rows.length === 0
      ? '🌑 Полки пусты — ни одного кикстартера. Загляни позже.'
      : '🎯 Кикстартеры на полке — тыкни любой, покажу его поближе.';
  await answerThenEdit(ctx, header, catalogKeyboard(rows, ownedIds));
}

/** The «my kickstarters» screen; shared by the ksMine callback and /mykickstarters. */
export async function renderMyKickstarters(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const rows = await listUserKickstarters(db, ctx.from.id);
  const header =
    rows.length === 0
      ? '🌑 Кикстартеры ты пока не брал — свитки твои целы.'
      : '🎯 Твоя добыча по кикстартерам — что уже взял:';
  await answerThenEdit(ctx, header, myKickstartersKeyboard(rows));
}

export function registerKickstarterActions(): void {
  router.on(ksCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const roles = ctx.state.roles ?? [];
    const isAdmin = hasAdminRank(roles);

    switch (payload.a) {
      case 'ksList': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await renderKsCatalog(ctx as unknown as Context);
        break;
      }
      case 'ksMine': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        await renderMyKickstarters(ctx as unknown as Context);
        break;
      }
      case 'ksView': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Ничего не нашлось');
          return;
        }
        const owned = await hasUserPurchased(db, ctx.from.id, payload.id);
        await answerThenEdit(ctx as unknown as Context, formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...userViewKeyboard(ks, owned, isAdmin),
        });
        break;
      }
      case 'ksScrollAsk': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Ничего не нашлось');
          return;
        }
        const balance = await getScrollBalance(db, ctx.from.id, DEFAULT_SCROLL_ID);
        if (balance < 1) {
          await ctx.answerCbQuery?.(`Свитков не хватает (${balance}/1). Сперва заработай.`, {
            show_alert: true,
          });
          return;
        }
        await answerThenEdit(
          ctx as unknown as Context,
          `${formatKickstarterCard(ks)}\n\n🎟 Отдашь 1 свиток за этот кикстартер? В сумке у тебя: ${balance}. Назад свиток не отдам.`,
          { parse_mode: 'HTML', ...scrollConfirmKeyboard(ks) },
        );
        break;
      }
      case 'ksBuyScroll': {
        if (!(await ensureApprovedMember(ctx as unknown as Context))) break;
        const result = await purchaseWithScroll({
          userId: ctx.from.id,
          kickstarterId: payload.id,
          scrollId: DEFAULT_SCROLL_ID,
        });
        if (result.status === 'not_found') {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        if (result.status === 'insufficient_scrolls') {
          await ctx.answerCbQuery?.(`Не хватает свитков (${result.available}/${result.required})`, {
            show_alert: true,
          });
          return;
        }
        if (result.status === 'already_owned' || result.status === 'purchased') {
          // Deliver files (don't await — fire and forget over Telegram)
          for (const fileId of result.fileIds) {
            try {
              await ctx.replyWithDocument(fileId);
            } catch (err) {
              logger.warn({ err, fileId }, 'kickstarter file delivery failed');
            }
          }
          await ctx.answerCbQuery?.(result.status === 'purchased' ? 'Куплено' : 'Уже куплено');
          // Re-render the card without the buy buttons now that it's owned.
          try {
            await ctx.editMessageText(formatKickstarterCard(result.kickstarter), {
              parse_mode: 'HTML',
              ...userViewKeyboard(result.kickstarter, true, isAdmin),
            });
          } catch (err) {
            logger.debug({ err }, 'ksBuyScroll: card refresh failed');
          }
        }
        break;
      }
      case 'ksAdminMenu': {
        if (!isAdmin) {
          await ctx.answerCbQuery?.('Не дозволено');
          return;
        }
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        await ctx.answerCbQuery?.();
        await editOrReply(ctx as unknown as Context, formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...adminEditKeyboard(ks),
        });
        break;
      }
      case 'ksEdit': {
        if (!isAdmin) {
          await ctx.answerCbQuery?.('Не дозволено');
          return;
        }
        const sceneId = EDIT_SCENE_ID[payload.f];
        if (!sceneId) {
          await ctx.answerCbQuery?.('Поле не поддерживается');
          return;
        }
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(sceneId, {
          kickstarterId: payload.id,
        });
        break;
      }
    }
  });
}
