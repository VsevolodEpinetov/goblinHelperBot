const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('showPurchasedKickstarters', async (ctx) => {
  if (!ctx.kickstarters.list) ctx.kickstarters.list = [];
  const userId = ctx.callbackQuery.from.id;
  const userData = ctx.users.list[userId];
  const purchasedKickstarters = userData.purchases.kickstarters;

  let menu = [];
  let message = `<b>Мои покупки</b>\n\n`

  purchasedKickstarters.forEach((ksId, id) => {
    menu.push(Markup.button.callback(id + 1, `sendFilesKickstarter_${userId}_${ksId}`))
    message += `${id + 1}. ${ctx.kickstarters.list[ksId].creator} - ${ctx.kickstarters.list[ksId].name}\n`
  });

  menu = util.splitMenu(menu)

  message += `\n<i>Нажми на кнопку, чтобы получить файлы</i>`;
  
  ctx.editMessageText(message, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      ...menu,
      [
        Markup.button.callback('🏠', 'userMenu')
      ]
    ])
  })
});