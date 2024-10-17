const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^showKickstarterFromGoblin_/g, async (ctx) => {
  const projectID = ctx.callbackQuery.data.split('_')[1];
  const projectData = ctx.kickstarters.list[projectID];
  const userId = ctx.callbackQuery.from.id;
  const userData = ctx.users.list[userId];
  const tickets = (Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent) || 0;

  ctx.userSession.purchasing = {
    type: 'kickstarter',
    userId: userId,
    ksId: projectID,
    name: projectData.name,
    price: projectData.cost
  }

  let buttons = [
    Markup.button.callback('Купить', `sendPayment`)
  ];

  if (tickets > 0 && projectData.cost < 500) {
    buttons = [
      [
        Markup.button.callback('Купить', `sendPayment`),
        Markup.button.callback(`Купить за 🎟`, `getKickstarterForTicket_${userId}_${projectID}`)
      ]
    ]
  }

  if (util.isSuperUser(ctx.callbackQuery.from.id)) {
    buttons = [
      [
        Markup.button.callback('✍️', `editKickstarter_${projectID}`),
        Markup.button.callback('🗑', `deleteKickstarter_${projectID}`),
        Markup.button.callback('Купить', `sendPayment`),
      ],
      [
        Markup.button.callback('В начало', `adminMenu`),
      ]
    ]
  }


  if (projectData.photos.length > 0) {

    await ctx.telegram.sendPhoto(userId, projectData.photos[0], {
      caption: `${projectData.link}\n\n<b>Название:</b> ${projectData.name}\n<b>Автор:</b> ${projectData.creator}\n<b>Пледж:</b> ${projectData.pledgeName}\n<b>Оригинальная стоимость:</b> $${projectData.pledgeCost}\n\n<b>Количество файлов:</b> ${projectData.files.length}\n\n<b>Стоимость:</b> ${projectData.cost}₽`,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });

  }
});