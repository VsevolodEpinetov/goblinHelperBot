import type { Telegraf } from 'telegraf';

import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';

import { getActiveCooldown, pickPromoFileForUser, recordPromoUsage } from './repo';
import { promoCallback } from './schemas';
import { computeCooldownUntil, formatTimeRemaining } from './service';

const NO_PROMOS = 'Сейчас нет доступных промо. Попробуй позже.';

export function register(_bot: Telegraf): void {
  router.on(promoCallback, async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    try {
      const cooldown = await getActiveCooldown(db, ctx.from.id);
      if (cooldown) {
        await ctx.answerCbQuery?.(`На кулдауне ещё ${formatTimeRemaining(cooldown)}`, {
          show_alert: true,
        });
        return;
      }
      const file = await pickPromoFileForUser(db, ctx.from.id);
      if (!file) {
        await ctx.answerCbQuery?.(NO_PROMOS, { show_alert: true });
        return;
      }
      await recordPromoUsage(db, ctx.from.id, file.id, computeCooldownUntil());
      await ctx.answerCbQuery?.();
      switch (file.file_type) {
        case 'photo':
          await ctx.replyWithPhoto(file.file_id);
          break;
        case 'video':
          await ctx.replyWithVideo(file.file_id);
          break;
        case 'document':
          await ctx.replyWithDocument(file.file_id);
          break;
        case 'animation':
          await ctx.replyWithAnimation(file.file_id);
          break;
        case 'sticker':
          await ctx.replyWithSticker(file.file_id);
          break;
      }
    } catch (err) {
      logger.error({ err }, 'promo: delivery failed');
      await ctx.answerCbQuery?.('Что-то сломалось. Попробуй позже.', { show_alert: true });
    }
  });
}
