import { Markup, Scenes } from 'telegraf';

import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { db } from '../../db/client';

import { insertPending } from './repo';

export interface SbpDraft {
  period?: string;
  tier?: 'regular' | 'plus';
  amount?: number; // RUB amount the user claims to have sent
  adminChatId?: string; // forwarded to this chat for admin review
}

export const SBP_SCENE_ID = 'payment:sbp';

export const sbpScene = new Scenes.BaseScene<Scenes.SceneContext>(SBP_SCENE_ID);

sbpScene.enter(async (ctx) => {
  const draft = ctx.scene.state as SbpDraft;
  if (!draft.period || !draft.tier) {
    await ctx.reply('Не указан период или тариф. Зайди заново через меню покупки.');
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(
    `Пришли скриншот платежа за ${draft.tier === 'plus' ? 'Plus' : 'обычную'} подписку (${draft.period}). Админ подтвердит вручную.`,
  );
});

sbpScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

sbpScene.on('photo', async (ctx) => {
  if (!ctx.from) return;
  const draft = ctx.scene.state as SbpDraft;
  if (!draft.period || !draft.tier || !draft.adminChatId) {
    await ctx.reply('Внутренняя ошибка: не хватает данных. Попробуй заново.');
    await ctx.scene.leave();
    return;
  }
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  if (!photo) {
    await ctx.reply('Не вижу фото.');
    return;
  }

  const paymentId = await insertPending(db, {
    userId: ctx.from.id,
    type: 'sub',
    subscriptionType: draft.tier,
    period: draft.period,
    amount: draft.amount ?? 0,
    currency: 'RUB',
    invoiceMessageId: null,
    isUpgrade: false,
    source: 'sbp',
  });

  try {
    await bot.telegram.sendPhoto(draft.adminChatId, photo.file_id, {
      caption: `SBP заявка #${paymentId}\nПользователь: ${ctx.from.id} (@${ctx.from.username ?? '—'})\nПериод: ${draft.period}\nТариф: ${draft.tier}`,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', `sbp:confirm:${paymentId}`),
          Markup.button.callback('❌ Отклонить', `sbp:reject:${paymentId}`),
        ],
      ]),
    });
    await ctx.reply('Заявка отправлена. Жди подтверждения админа.');
  } catch (err) {
    logger.error({ err, paymentId }, 'sbp: failed to forward to admin chat');
    await ctx.reply('Не удалось отправить заявку админу. Попробуй позже.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});

sbpScene.on('text', async (ctx) => {
  await ctx.reply('Пришли скриншот или /cancel.');
});
