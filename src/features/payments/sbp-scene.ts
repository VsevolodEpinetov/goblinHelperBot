import { Markup, Scenes } from 'telegraf';

import { bot } from '../../core/bot';
import { editOrReply } from '../../core/nav';
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { formatPrice } from '../../shared/format';
import { homeButton, memberHubKeyboard } from '../onboarding/menus';
import { sbpRequisites } from '../subscriptions/pricing';
import { subscriptionsCallback } from '../subscriptions/schemas';

import { insertPending } from './repo';

export interface SbpDraft {
  period?: string;
  tier?: 'regular' | 'plus';
  /** Whether this is a past ('old') archive vs the current month ('sub'). Drives
   * the persisted payment type and the XP granted on admin confirm. */
  kind?: 'sub' | 'old';
  amount?: number; // expected RUB amount (from SBP_PRICE_*_RUB), when configured
  adminChatId?: string; // forwarded to this chat for admin review
}

const homeKb = Markup.inlineKeyboard([[homeButton()]]);
const cancelRow = [Markup.button.callback('« Отмена', 'sbp:cancel')];
const backToBuyKb = Markup.inlineKeyboard([
  [
    Markup.button.callback(
      '🪙 Снова к покупке',
      router.encode(subscriptionsCallback, { a: 'subOpen' }),
    ),
  ],
  [homeButton()],
]);

export const SBP_SCENE_ID = 'payment:sbp';

export const sbpScene = new Scenes.BaseScene<Scenes.SceneContext>(SBP_SCENE_ID);

sbpScene.enter(async (ctx) => {
  const draft = ctx.scene.state as SbpDraft;
  if (!draft.period || !draft.tier) {
    await ctx.reply(
      '🕯 Растерял я твой свиток оплаты — ни периода, ни архива уже не разобрать. Начинай заново, кнопки ниже.',
      backToBuyKb,
    );
    await ctx.scene.leave();
    return;
  }
  const lines = [
    `🪙 Кидай скрин перевода по СБП за ${draft.tier === 'plus' ? 'расширенный' : 'обычный'} архив — ${draft.period}.`,
  ];
  if (draft.amount) lines.push(`К оплате: ${formatPrice(draft.amount, 'RUB')} — ни рублём меньше.`);
  const requisites = sbpRequisites();
  if (requisites) lines.push(`Куда слать рубли: ${requisites}`);
  lines.push('Совет глянет и зачтёт руками — это не мигом, потерпи. Передумал — жми «Отмена».');
  await ctx.reply(lines.join('\n'), Markup.inlineKeyboard([cancelRow]));
});

async function leaveSbp(ctx: Scenes.SceneContext): Promise<void> {
  ctx.scene.state = {};
  await ctx.scene.leave();
}

sbpScene.command('cancel', async (ctx) => {
  await leaveSbp(ctx);
  await ctx.reply(
    '🌑 Бросил оплату — заявку совету не понёс. Если рубли уже перевёл, вернись и донеси скрин.',
    homeKb,
  );
});

sbpScene.action('sbp:cancel', async (ctx) => {
  await leaveSbp(ctx);
  await ctx.answerCbQuery?.();
  await editOrReply(
    ctx,
    '🌑 Бросил оплату — заявку совету не понёс. Если рубли уже перевёл, вернись и донеси скрин.',
    memberHubKeyboard(),
  );
});

async function submitProof(
  ctx: Scenes.SceneContext,
  file: { fileId: string; asDocument: boolean },
): Promise<void> {
  if (!ctx.from) return;
  const draft = ctx.scene.state as SbpDraft;
  if (!draft.period || !draft.tier || !draft.adminChatId) {
    await ctx.scene.leave();
    await ctx.reply('Внутренняя ошибка: не хватает данных. Попробуй заново.', homeKb);
    return;
  }
  const payType = draft.kind ?? 'sub';

  // Reuse an existing pending row for the same (user, period, tier) instead of
  // stacking multiple. If the user submits twice (re-enters the scene, sends
  // another screenshot), the admin sees one row, not many.
  const existing = await db('payment_tracking')
    .where({
      user_id: ctx.from.id,
      type: payType,
      subscription_type: draft.tier,
      period: draft.period,
      source: 'sbp',
      status: 'pending',
    })
    .first('id');
  const paymentId: number =
    existing?.id ??
    (await insertPending(db, {
      userId: ctx.from.id,
      type: payType,
      subscriptionType: draft.tier,
      period: draft.period,
      amount: draft.amount ?? 0,
      currency: 'RUB',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'sbp',
    }));

  try {
    const extra = {
      caption: `SBP заявка #${paymentId}\nПользователь: ${ctx.from.id} (@${ctx.from.username ?? '—'})\nПериод: ${draft.period}\nТариф: ${draft.tier}${draft.amount ? `\nОжидаемая сумма: ${formatPrice(draft.amount, 'RUB')}` : ''}`,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', `sbp:confirm:${paymentId}`),
          Markup.button.callback('❌ Отклонить', `sbp:reject:${paymentId}`),
        ],
      ]),
    };
    if (file.asDocument) await bot.telegram.sendDocument(draft.adminChatId, file.fileId, extra);
    else await bot.telegram.sendPhoto(draft.adminChatId, file.fileId, extra);
    await ctx.scene.leave();
    await ctx.reply(
      '🪙 Унес твой скрин наверх, совету. Зачтут перевод — ключ от архива придёт сам. Жди, не дёргай.',
      homeKb,
    );
  } catch (err) {
    logger.error({ err, paymentId }, 'sbp: failed to forward to admin chat');
    await ctx.scene.leave();
    await ctx.reply('Не удалось отправить заявку совету. Попробуй позже.', homeKb);
  } finally {
    ctx.scene.state = {};
  }
}

sbpScene.on('photo', async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  if (!photo) {
    await ctx.reply(
      '🕯 Не разглядел я твою картинку — пришли скрин ещё раз.',
      Markup.inlineKeyboard([cancelRow]),
    );
    return;
  }
  await submitProof(ctx, { fileId: photo.file_id, asDocument: false });
});

sbpScene.on('document', async (ctx) => {
  const doc = ctx.message.document;
  const mime = doc.mime_type ?? '';
  if (!mime.startsWith('image/') && mime !== 'application/pdf') {
    await ctx.reply(
      'Такой файл не возьму. Кидай скрин картинкой или PDF из банка, или жми «Отмена».',
      Markup.inlineKeyboard([cancelRow]),
    );
    return;
  }
  await submitProof(ctx, { fileId: doc.file_id, asDocument: true });
});

sbpScene.on('text', async (ctx) => {
  await ctx.reply(
    'Словами не расплатишься. Неси скрин оплаты — картинкой или PDF, или жми «Отмена».',
    Markup.inlineKeyboard([cancelRow]),
  );
});

sbpScene.on('message', async (ctx) => {
  await ctx.reply(
    'Такое не возьму. Неси скрин оплаты — картинкой или PDF, или жми «Отмена».',
    Markup.inlineKeyboard([cancelRow]),
  );
});
