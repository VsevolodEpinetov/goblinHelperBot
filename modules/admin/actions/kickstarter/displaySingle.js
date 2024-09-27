const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^showKickstarter_/g, async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

  const resultID = ctx.callbackQuery.data.split('_')[1];
  const projectID = ctx.userSession.results[resultID];
  const projectData = ctx.kickstarters.list[projectID];
  const userId = ctx.callbackQuery.from.id;
  const userData = ctx.users.list[userId];
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;

  ctx.userSession.purchasing = {
    type: 'kickstarter',
    userId: userId,
    ksId: projectID,
    name: projectData.name,
    price: projectData.cost
  }

  let buttons = [
    Markup.button.callback('Купить', `sendPayment`),
    Markup.button.callback('←', `searchResultKickstarter`),
  ];

  if (tickets > 0) {
    buttons = [
      [
        Markup.button.callback('Купить', `sendPayment`),
        Markup.button.callback(`Купить за 🎟`, `getKickstarterForTicket_${userId}_${projectID}`)
      ],
      [
        Markup.button.callback('←', `searchResultKickstarter`)
      ]
    ]
  }

  if (ctx.callbackQuery.from.id == SETTINGS.CHATS.EPINETOV) {
    buttons = [
      [
        Markup.button.callback('✍️', `editKickstarter_${projectID}`),
        Markup.button.callback('🗑', `deleteKickstarter_${projectID}`)
      ],
      [
        Markup.button.callback('←', `searchResultKickstarter`),
        Markup.button.callback('В начало', `adminMenu`),
      ]
    ]
  }


  if (projectData.photos.length > 0) {

    await ctx.replyWithPhoto(projectData.photos[0], {
      caption: `${projectData.link}\n\nНазвание: ${projectData.name}\nАвтор: ${projectData.creator}\nПледж: ${projectData.pledgeName}\nОригинальная стоимость: $${projectData.pledgeCost}\n\nКоличество файлов: ${projectData.files.length}\n\nСтоимость: ${projectData.cost}₽`,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });

  }
});