import type { Scenes } from 'telegraf';

import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';

import { formatKickstarterCard, formatKickstarterShort } from './format';
import { adminEditKeyboard, DEFAULT_SCROLL_ID, userViewKeyboard } from './menus';
import { getKickstarterById, hasUserPurchased, listKickstarters } from './repo';
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

export function registerKickstarterActions(): void {
  router.on(ksCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const roles = ctx.state.roles ?? [];
    const isAdmin = roles.includes('admin') || roles.includes('super');

    switch (payload.a) {
      case 'ksList': {
        const rows = await listKickstarters(db);
        const body =
          rows.length === 0 ? 'Пока пусто.' : rows.map(formatKickstarterShort).join('\n');
        await ctx.editMessageText(body);
        await ctx.answerCbQuery?.();
        break;
      }
      case 'ksView': {
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        const owned = await hasUserPurchased(db, ctx.from.id, payload.id);
        await ctx.reply(formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...userViewKeyboard(ks, owned),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'ksBuyScroll': {
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
        }
        break;
      }
      case 'ksAdminMenu': {
        if (!isAdmin) {
          await ctx.answerCbQuery?.('Нет прав');
          return;
        }
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        await ctx.reply(formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...adminEditKeyboard(ks),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'ksEdit': {
        if (!isAdmin) {
          await ctx.answerCbQuery?.('Нет прав');
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
