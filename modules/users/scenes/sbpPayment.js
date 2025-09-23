const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { getUser } = require('../../db/helpers');
const { hasAchievement } = require('../../loyalty/achievementsService');
const util = require('../../util');

const sceneSbpPayment = new Scenes.BaseScene('SBP_PAYMENT');

sceneSbpPayment.enter(async (ctx) => {
  // SECURITY CHECK: Verify user has SBP payment achievement before showing sensitive data
  const SBP_PAYMENT = 'sbp_payment';
  const hasSbpPayment = await hasAchievement(Number(ctx.from.id), SBP_PAYMENT);
  
  if (!hasSbpPayment) {
    await ctx.replyWithHTML(
      '🔒 <b>Доступ запрещён</b>\n\n' +
      'Эта функция доступна только пользователям с особыми правами.\n' +
      'Обратитесь к администратору для получения доступа.',
      {
        ...Markup.inlineKeyboard([
          Markup.button.callback('⬅️ Назад', 'refreshUserStatus')
        ])
      }
    );
    ctx.scene.leave();
    return;
  }

  const message = 
    `🏦 <b>Оплата через СБП</b>\n\n` +
    `Гоблины принимают золото и людскими путями.\n` +
    `Система быстрых платежей (СБП) позволяет перекинуть звёзды напрямую.\n\n` +
    `📲 <b>Реквизиты:</b>\n` +
    `🏦 Банк: Т-Банк\n` +
    `📞 Телефон: +7 999 200-45-52\n` +
    `👤 Получатель: Епинетов Е\n\n` +
    `⚠️ После перевода пришли скриншот или файл с подтверждением — и дверь в архив откроется.\n\n` +
    `🕯 Слова Главгоблина: кто платит быстро — тот и доступ получает быстрее.`;

  await ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      Markup.button.callback('❌ Отмена', 'cancelSbpPayment')
    ])
  }).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

sceneSbpPayment.on(['photo', 'document'], async (ctx) => {
  await ctx.deleteMessage(ctx.session.toRemove);

  const userId = ctx.message.from.id;
  const purchaseInfo = ctx.userSession.purchasing;
  const userInfo = await getUser(purchaseInfo.userId);
  
  if (!userInfo) {
    await ctx.reply('Пользователь не найден');
    return;
  }

  let message = `Уведомление об оплате через СБП\n\n<b>Имя:</b> ${userInfo.first_name}\n<b>Telegram Username</b>: @${userInfo.username}\n<b>Telegram ID</b>: ${userId}\n`
  message += `\nПокупает: `

  const menu = [];

  switch (purchaseInfo.type) {
    case 'group':
      if (purchaseInfo.isOld) {
        message += `доступ к ${purchaseInfo.year}-${purchaseInfo.month}\n<i>Ожидаемая стоимость: 1800₽ / 3000₽ / 4800₽</i>\n\n`
      } else {
        message += `текущую подписку\n\n<i>Ожидаемая стоимость: 600₽ / 1600₽</i>\n\n`
      }
      menu.push([
        Markup.button.callback('Выдать обычную', `confirmPayment_${userId}_group_${purchaseInfo.year}_${purchaseInfo.month}_regular`),
        Markup.button.callback('Выдать плюс', `confirmPayment_${userId}_group_${purchaseInfo.year}_${purchaseInfo.month}_plus`)
      ])
      break;
    case 'kickstarter':
      message += `кикстартер ${purchaseInfo.name}\n<i>Ожидаемая стоимость: ${purchaseInfo.price}₽</i>`
      menu.push([
        Markup.button.callback('Выдать кикстартер', `confirmPayment_${userId}_kickstarter_${purchaseInfo.ksId}`),
      ])
      break;
    case 'collection':
      message += `постоянную коллекцию ${purchaseInfo.name}\n<i>Ожидаемая стоимость: ${purchaseInfo.price}₽</i>`
      menu.push([
        Markup.button.callback('Выдать доступ', `confirmPayment_${userId}_collection_${purchaseInfo.collectionId}`),
      ])
      break;
    case 'release':
      message += `релиз ${purchaseInfo.studioName} ${purchaseInfo.year}-${purchaseInfo.month}\n<i>Ожидаемая стоимость: ${purchaseInfo.price}₽</i>`
      menu.push([
        Markup.button.callback('Выдать релиз', `confirmPayment_${userId}_release_${purchaseInfo.studioName}_${purchaseInfo.year}_${purchaseInfo.month}`),
      ])
      break;
  }

  const currentTimestamp = Date.now();

  // Send to EPINETOV
  const newCtx1 = await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, '-----------');
  const newCtx2 = await ctx.telegram.forwardMessage(SETTINGS.CHATS.EPINETOV, ctx.message.from.id, ctx.message.message_id);
  const newCtx3 = await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, message, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      ...menu,
      [
        Markup.button.callback('❌ Закончить', `finishAdminPayment_${userId}-${currentTimestamp}`)
      ]
    ]),
  })
  const newCtx4 = await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, '-----------');

  // Send to GLAVGOBLIN
  const glavCtx1 = await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, '-----------');
  const glavCtx2 = await ctx.telegram.forwardMessage(SETTINGS.CHATS.GLAVGOBLIN, ctx.message.from.id, ctx.message.message_id);
  const glavCtx3 = await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, message, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      ...menu,
      [
        Markup.button.callback('❌ Закончить', `finishAdminPayment_${userId}-${currentTimestamp}`)
      ]
    ]),
  })
  const glavCtx4 = await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, '-----------');

  if (!ctx.globalSession.toRemove) ctx.globalSession.toRemove = {}
  if (!ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV]) ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV] = {}
  if (!ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN]) ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN] = {}
  ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV][`${userId}-${currentTimestamp}`] = [newCtx1.message_id, newCtx2.message_id, newCtx3.message_id, newCtx4.message_id]
  ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN][`${userId}-${currentTimestamp}`] = [glavCtx1.message_id, glavCtx2.message_id, glavCtx3.message_id, glavCtx4.message_id]

  await ctx.deleteMessage(ctx.message.message_id);
  ctx.replyWithHTML(
    `💰 <b>Оплата отправлена на проверку</b>\n\n` +
    `Главгоблин и старейшины уже сверяют записи.\n` +
    `Обычно решение выносится в течение 24 часов.\n\n` +
    `🕯 Терпение — добродетель гоблина.`
  );

  ctx.scene.leave();
});

sceneSbpPayment.action('cancelSbpPayment', async ctx => {
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Оплата отменена. Используй /start, чтобы вызвать меню`)
  ctx.scene.leave();
})

module.exports = sceneSbpPayment;
