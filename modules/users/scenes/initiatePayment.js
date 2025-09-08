const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { getUser } = require('../../db/helpers');

const sceneSendPayment = new Scenes.BaseScene('SEND_PAYMENT');

sceneSendPayment.enter(async (ctx) => {
  let message = `💰 Оплата `
  const purchaseInfo = ctx.userSession.purchasing;
  
  switch (purchaseInfo.type) {
    case 'group':
      if (purchaseInfo.isOld) {
        message += `доступа к ${purchaseInfo.year}-${purchaseInfo.month}\n\n<i>Стоимость: 1800₽ (без ➕) / 4800₽ (с ➕)</i>\n\n`
      } else {
        message += `месячной подписки\n\n<i>Стоимость: 600₽ (без ➕) / 1600₽ (с ➕)</i>\n\n`
      }
      break;
    case 'kickstarter':
      message += `кикстартера ${purchaseInfo.name}\n\n<i>Стоимость: ${purchaseInfo.price}₽</i>\n\n`
      break;
    case 'collection':
      message += `постоянной коллекции ${purchaseInfo.name}\n\n<i>Стоимость: ${purchaseInfo.price}₽</i>\n\n`
      break;
    case 'release':
      message += `релиза ${purchaseInfo.studioName} ${purchaseInfo.year}-${purchaseInfo.month}\n\n<i>Стоимость: ${purchaseInfo.price}₽</i>\n\n`
      break;
  }

  message += `<u>Способы оплаты</u>\n🔗 <b>Форма Т-Банк:</b> <a href="https://www.tinkoff.ru/rm/epinetov.vsevolod1/HTZyQ19708/">Оплатить</a>\n💳 <b>Номер карты:</b> 2200 7010 6757 0900\n📲 <b>СБП:</b> +7 999 200-45-52 (Т-Банк)\n\n📷 После оплаты пришли сюда чек/скриншот`


  await ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      Markup.button.callback('❌ Отмена', 'cancelPayment')
    ])
  }).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

sceneSendPayment.on(['photo', 'document'], async (ctx) => {
  await ctx.deleteMessage(ctx.session.toRemove);

  const userId = ctx.message.from.id;
  const purchaseInfo = ctx.userSession.purchasing;
  const userInfo = await getUser(purchaseInfo.userId);
  
  if (!userInfo) {
    await ctx.reply('Пользователь не найден');
    return;
  }

  let message = `Уведомление об оплате\n\n<b>Имя:</b> ${userInfo.first_name}\n<b>Telegram Username</b>: @${userInfo.username}\n<b>Telegram ID</b>: ${userId}\n`
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
        Markup.button.callback('Подтвердить обычную', `confirmPayment_${userId}_group_${purchaseInfo.year}_${purchaseInfo.month}_regular`),
        Markup.button.callback('Подтвердить плюс', `confirmPayment_${userId}_group_${purchaseInfo.year}_${purchaseInfo.month}_plus`)
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
  const newCtx3 = await  ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, message, {
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
  const glavCtx3 = await  ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, message, {
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
  ctx.replyWithHTML(`Твоя оплата была отправлена на проверку. Ожидай подтверждения, обычно это происходит в течение 24 часов`)

  ctx.scene.leave();

});

sceneSendPayment.action('cancelPayment', async ctx => {
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Оплата отменена. Используй /start, чтобы вызвать меню`)
  ctx.scene.leave();
})

module.exports = sceneSendPayment;
 