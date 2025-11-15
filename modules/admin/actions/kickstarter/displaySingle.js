const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarter, getUser } = require('../../../db/helpers');

module.exports = Composer.action(/^showKickstarter_/g, async (ctx) => {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }

  const resultID = ctx.callbackQuery.data.split('_')[1];
  const projectID = ctx.userSession.results[resultID];
  const projectData = await getKickstarter(projectID);
  const userId = ctx.callbackQuery.from.id;
  const userData = await getUser(userId);
  
  if (!projectData || !userData) {
    await ctx.replyWithHTML('Данные не найдены');
    return;
  }
  
  // Check if user already has this kickstarter
  const hasKickstarter = userData.purchases.kickstarters.includes(String(projectID));
  
  let buttons = [];
  if (!hasKickstarter) {
    buttons = [
      [Markup.button.callback('Провести ритуал', `purchaseKickstarter_${projectID}`)],
      [Markup.button.callback('←', `searchResultKickstarter`)]
    ];
  } else {
    buttons = [
      [Markup.button.callback('✅ Уже куплено', 'userKickstarters')],
      [Markup.button.callback('←', `searchResultKickstarter`)]
    ];
  }

  if (util.isSuperUser(ctx.callbackQuery.from.id)) {
    buttons = [
      [
        Markup.button.callback('✍️', `editKickstarter_${projectID}`),
        Markup.button.callback('📁♻️', `replaceFilesKickstarter_${projectID}`),
        Markup.button.callback('🗑', `deleteKickstarter_${projectID}`)
      ],
      [
        Markup.button.callback('←', `searchResultKickstarter`),
        Markup.button.callback('В начало', `userMenu`),
      ]
    ]
  }


  if (projectData.photos.length > 0) {

    await ctx.replyWithPhoto(projectData.photos[0], {
      caption: `${projectData.link}\n\n<b>Название:</b> ${projectData.name}\n<b>Автор:</b> ${projectData.creator}\n<b>Пледж:</b> ${projectData.pledgeName}\n<b>Оригинальная стоимость:</b> $${projectData.pledgeCost}\n\n<b>Количество файлов:</b> ${projectData.files.length}\n\n<b>Стоимость:</b> ${projectData.cost}₽`,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });

  }
});