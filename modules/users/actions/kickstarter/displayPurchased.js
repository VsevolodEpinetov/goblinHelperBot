const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarters, getUser } = require('../../../db/helpers');

module.exports = Composer.action('showPurchasedKickstarters', async (ctx) => {
  const kickstartersData = await getKickstarters();
  const userId = ctx.callbackQuery.from.id;
  const userData = await getUser(userId);
  const purchasedKickstarters = userData.purchases.kickstarters;

  let menu = [];
  let message = t('kickstarters.purchased.title') + '\n\n'

  purchasedKickstarters.forEach((ksId, id) => {
    menu.push(Markup.button.callback(id + 1, `sendFilesKickstarter_${userId}_${ksId}`))
    message += `${id + 1}. ${kickstartersData.list[ksId].creator} - ${kickstartersData.list[ksId].name}\n`
  });

  menu = util.splitMenu(menu)

  message += t('kickstarters.purchased.clickToGet');
  
  ctx.editMessageText(message, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      ...menu,
      [
        Markup.button.callback(t('buttons.homeIcon'), 'userMenu')
      ]
    ])
  })
});