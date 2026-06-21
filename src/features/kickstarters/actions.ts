import type { Context, Scenes } from 'telegraf';

import { answerThenEdit, homeKeyboard } from '../../core/nav';
import { logger } from '../../core/observability';
import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { getScrollBalance } from '../scrolls';

import { isKsManager } from './constants';
import { formatKickstarterCard } from './format';
import {
  adminEditKeyboard,
  catalogKeyboard,
  DEFAULT_SCROLL_ID,
  KS_PAGE_SIZE,
  myKickstartersKeyboard,
  scrollConfirmKeyboard,
  userViewKeyboard,
} from './menus';
import {
  getKickstarterById,
  getKickstarterFiles,
  getKickstarterPhotos,
  hasUserPurchased,
  type KickstarterRow,
  listKickstarters,
  listUserKickstarters,
} from './repo';
import { KS_ADD_CHAIN } from './scenes/add-chain';
import { KS_SEARCH_SCENE_ID } from './scenes/search';
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

/** Telegram photo caption limit; longer cards fall back to a text message. */
const CAPTION_LIMIT = 1024;

function onPhotoMessage(ctx: Context): boolean {
  const m = ctx.callbackQuery?.message;
  return !!m && 'photo' in m;
}

async function dropMessage(ctx: Context): Promise<void> {
  try {
    await ctx.deleteMessage();
  } catch {
    /* message already gone or too old to delete */
  }
}

/**
 * Show a kickstarter card as a FRESH message — a photo (caption) when the card
 * has one, else text. A text message can't be edited into a photo, so card
 * navigation replaces the message instead of editing in place.
 */
async function showKickstarterCard(
  ctx: Context,
  ks: KickstarterRow,
  owned: boolean,
  canManage: boolean,
  backPage = 0,
): Promise<void> {
  const text = formatKickstarterCard(ks);
  const extra = {
    parse_mode: 'HTML' as const,
    ...userViewKeyboard(ks, owned, canManage, backPage),
  };
  const photos = await getKickstarterPhotos(db, ks.id);
  if (photos[0] && text.length <= CAPTION_LIMIT) {
    await ctx.replyWithPhoto(photos[0].fileId, { caption: text, ...extra });
  } else {
    await ctx.reply(text, extra);
  }
}

/**
 * Render a text list screen. When the current message is a photo card (which
 * can't be edited into text), drop it and post fresh; otherwise edit in place
 * so paging stays smooth.
 */
async function answerThenShowList(
  ctx: Context,
  text: string,
  extra: Parameters<typeof answerThenEdit>[2],
): Promise<void> {
  if (ctx.callbackQuery && onPhotoMessage(ctx)) {
    try {
      await ctx.answerCbQuery();
    } catch {
      /* query expired */
    }
    await dropMessage(ctx);
    await ctx.reply(text, extra);
  } else {
    await answerThenEdit(ctx, text, extra);
  }
}

/** The kickstarter catalogue; shared by the ksList callback and /kickstarters. */
export async function renderKsCatalog(ctx: Context, page = 0, unownedOnly = false): Promise<void> {
  if (!ctx.from) return;
  const mine = await listUserKickstarters(db, ctx.from.id);
  const ownedIds = new Set(mine.map((k) => k.id));
  const rows = await listKickstarters(db, {
    limit: KS_PAGE_SIZE + 1,
    offset: page * KS_PAGE_SIZE,
    excludeIds: unownedOnly ? [...ownedIds] : undefined,
  });
  const hasNext = rows.length > KS_PAGE_SIZE;
  const pageRows = rows.slice(0, KS_PAGE_SIZE);
  const header =
    pageRows.length === 0
      ? unownedOnly
        ? '🌑 Новых для тебя кикстартеров нет — всё уже взято.'
        : '🌑 Полки пусты — ни одного кикстартера. Загляни позже.'
      : '🎯 Кикстартеры на полке. Тыкни любой — покажу поближе. Листай, ищи или скрой купленные:';
  await answerThenShowList(
    ctx,
    header,
    catalogKeyboard(pageRows, ownedIds, page, hasNext, unownedOnly),
  );
}

/** The «my kickstarters» screen; shared by the ksMine callback and /mykickstarters. */
export async function renderMyKickstarters(ctx: Context, page = 0): Promise<void> {
  if (!ctx.from) return;
  const all = await listUserKickstarters(db, ctx.from.id);
  const hasNext = all.length > (page + 1) * KS_PAGE_SIZE;
  const pageRows = all.slice(page * KS_PAGE_SIZE, (page + 1) * KS_PAGE_SIZE);
  const header =
    all.length === 0
      ? '🌑 Кикстартеры ты пока не брал — свитки твои целы.'
      : '🎯 Твоя добыча по кикстартерам — что уже взял:';
  await answerThenShowList(ctx, header, myKickstartersKeyboard(pageRows, page, hasNext));
}

/**
 * One kickstarter's full card as a fresh message, shared by the `ks_<id>` deep
 * link tapped from the group promo's «Провести ритуал» button — it lands the
 * member on the buy screen in DM.
 */
export async function renderKickstarterCard(ctx: Context, kickstarterId: number): Promise<void> {
  if (!ctx.from) return;
  const ks = await getKickstarterById(db, kickstarterId);
  if (!ks) {
    await ctx.reply('🌑 Этого кикстартера уже нет — добычу свернули.', homeKeyboard());
    return;
  }
  const owned = await hasUserPurchased(db, ctx.from.id, kickstarterId);
  const canManage = isKsManager(ctx.state.roles ?? []);
  await showKickstarterCard(ctx, ks, owned, canManage);
}

export function registerKickstarterActions(): void {
  router.on(ksCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const roles = ctx.state.roles ?? [];
    const canManage = isKsManager(roles);
    const c = ctx as unknown as Context;

    switch (payload.a) {
      case 'ksAdd': {
        // Delegate/admin entry into the create wizard from the member hub —
        // the admin-hub button (adKsAdd) is staff-only, so a delegate needs this.
        if (!canManage) {
          await ctx.answerCbQuery?.('Не дозволено');
          return;
        }
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(KS_ADD_CHAIN.steps[0]!, {});
        break;
      }
      case 'ksList': {
        if (!(await ensureApprovedMember(c))) break;
        await renderKsCatalog(c, payload.p ?? 0, payload.u ?? false);
        break;
      }
      case 'ksMine': {
        if (!(await ensureApprovedMember(c))) break;
        await renderMyKickstarters(c, payload.p ?? 0);
        break;
      }
      case 'ksSearch': {
        if (!(await ensureApprovedMember(c))) break;
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(KS_SEARCH_SCENE_ID, {});
        break;
      }
      case 'ksView': {
        if (!(await ensureApprovedMember(c))) break;
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Ничего не нашлось');
          return;
        }
        const owned = await hasUserPurchased(db, ctx.from.id, payload.id);
        await ctx.answerCbQuery?.();
        await dropMessage(c);
        await showKickstarterCard(c, ks, owned, canManage, payload.p ?? 0);
        break;
      }
      case 'ksScrollAsk': {
        if (!(await ensureApprovedMember(c))) break;
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
        await ctx.answerCbQuery?.();
        await dropMessage(c);
        await c.reply(
          `${formatKickstarterCard(ks)}\n\n🎟 Отдашь 1 свиток за этот кикстартер? В сумке у тебя: ${balance}. Назад свиток не отдам.`,
          { parse_mode: 'HTML', ...scrollConfirmKeyboard(ks) },
        );
        break;
      }
      case 'ksBuyScroll': {
        if (!(await ensureApprovedMember(c))) break;
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
          for (const fileId of result.fileIds) {
            try {
              await ctx.replyWithDocument(fileId);
            } catch (err) {
              logger.warn({ err, fileId }, 'kickstarter file delivery failed');
            }
          }
          await ctx.answerCbQuery?.(result.status === 'purchased' ? 'Куплено' : 'Уже куплено');
          await dropMessage(c);
          await showKickstarterCard(c, result.kickstarter, true, canManage);
        }
        break;
      }
      case 'ksRedownload': {
        if (!(await ensureApprovedMember(c))) break;
        if (!(await hasUserPurchased(db, ctx.from.id, payload.id))) {
          await ctx.answerCbQuery?.('Сначала проведи ритуал.', { show_alert: true });
          return;
        }
        const files = await getKickstarterFiles(db, payload.id);
        if (files.length === 0) {
          await ctx.answerCbQuery?.('Файлов у этого кикстартера нет.', { show_alert: true });
          return;
        }
        await ctx.answerCbQuery?.('Отправляю файлы…');
        for (const f of files) {
          try {
            await ctx.replyWithDocument(f.fileId);
          } catch (err) {
            logger.warn({ err, fileId: f.fileId }, 'ksRedownload: file delivery failed');
          }
        }
        break;
      }
      case 'ksAdminMenu': {
        if (!canManage) {
          await ctx.answerCbQuery?.('Не дозволено');
          return;
        }
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        await answerThenShowList(c, formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...adminEditKeyboard(ks),
        });
        break;
      }
      case 'ksEdit': {
        if (!canManage) {
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
