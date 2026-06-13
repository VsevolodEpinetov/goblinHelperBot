import { Markup } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';

import { logger } from '../../core/observability';
import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { homeButton } from '../onboarding/menus';

import { getActiveCooldown, pickPromoFileForUser, recordPromoUsage } from './repo';
import { promoCallback } from './schemas';
import { computeCooldownUntil, formatTimeRemaining } from './service';

const NO_PROMOS = '🌑 Сундук с подачками пуст — всё растащили. Загляни позже.';

export function register(_bot: Telegraf): void {
  router.on(promoCallback, async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    if (!(await ensureApprovedMember(ctx as unknown as Context))) return;
    let answered = false;
    try {
      const cooldown = await getActiveCooldown(db, ctx.from.id);
      if (cooldown) {
        await ctx.answerCbQuery?.(
          `Рано пришёл — подачку ты уже хватал. Жди ещё ${formatTimeRemaining(cooldown)}.`,
          { show_alert: true },
        );
        return;
      }
      const file = await pickPromoFileForUser(db, ctx.from.id);
      if (!file) {
        await ctx.answerCbQuery?.(NO_PROMOS, { show_alert: true });
        return;
      }
      await ctx.answerCbQuery?.();
      answered = true;
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
      await recordPromoUsage(db, ctx.from.id, file.id, computeCooldownUntil());
      await ctx.reply(
        '🪙 Держи добычу и проваливай — заглянешь ещё, ворота на месте.',
        Markup.inlineKeyboard([[homeButton()]]),
      );
    } catch (err) {
      logger.error({ err }, 'promo: delivery failed');
      try {
        if (answered) {
          await ctx.reply('🕯 Добыча выскользнула из лап — не донёс. Попробуй ещё раз чуть позже.');
        } else {
          await ctx.answerCbQuery?.(
            '🕯 Добыча выскользнула из лап — не донёс. Попробуй ещё раз чуть позже.',
            { show_alert: true },
          );
        }
      } catch {
        /* best effort */
      }
    }
  });
}
