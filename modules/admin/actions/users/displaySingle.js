const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^showUser_/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_')[1];
  const userData = ctx.users.list[userId];
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;

  ctx.editMessageText(`Информация о пользователе\n\n<b>ID:</b> ${userData.id}\n<b>Username: </b>${userData.username != 'not_set' ? '@' : ''}${userData.username}\n<b>Имя:</b> ${userData.first_name} ${userData.last_name}\n\n<b>Месяцы:</b> ${userData.purchases.groups.regular.length}+${userData.purchases.groups.plus.length}${userData.purchases.groups.plus.length > 0 ? ` (${tickets}🎟)` : ''}\n<b>Кикстартеры:</b> ${userData.purchases.kickstarters.length}\n<b>Коллекции:</b> ${userData.purchases.collections.length}\n<b>Баланс:</b> ${userData.purchases.balance}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`Месяцы`, `showUserMonths_${userId}`),
        Markup.button.callback(`Кикстартеры`, `showUserKickstarters_${userId}`),
        Markup.button.callback(`Коллекции`, `showUserCollections_${userId}`),
      ],
      [
        Markup.button.callback(`Баланс`, `changeBalance_${userId}`),
        Markup.button.callback(`Билетики`, `changeTickets_${userId}`),
      ],
      [
        Markup.button.callback('←', `adminParticipants`),
        Markup.button.callback('В начало', `adminMenu`),
      ]
    ])
  }
  )
});