const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarter, getUser } = require('../../../db/helpers');

module.exports = Composer.action(/^showKickstarterFromGoblin_/g, async (ctx) => {
  const projectID = ctx.callbackQuery.data.split('_')[1];
  const projectData = await getKickstarter(projectID);
  const userId = ctx.callbackQuery.from.id;
  const userData = await getUser(userId);
  
  // Check if user already has this kickstarter
  const hasKickstarter = userData.purchases.kickstarters.includes(String(projectID));
  
  let buttons = [];
  if (!hasKickstarter) {
    // Check for usable scrolls
    const { getUsableScrolls } = require('../../../util/scrolls');
    const usableScrolls = await getUsableScrolls(userId, projectData.cost);
    
    if (usableScrolls.length > 0) {
      // Show purchase button - purchase.js will handle scroll choice
      buttons = [
        [Markup.button.callback(t('kickstarters.single.buy'), `purchaseKickstarter_${projectID}`)]
      ];
    } else {
      buttons = [
        [Markup.button.callback(t('kickstarters.single.buy'), `purchaseKickstarter_${projectID}`)]
      ];
    }
  } else {
    buttons = [
      [Markup.button.callback('✅ Уже куплено', 'myKickstarters')]
    ];
  }

  if (util.isSuperUser(ctx.callbackQuery.from.id)) {
    buttons = [
      [
        Markup.button.callback(t('kickstarters.single.admin.edit'), `editKickstarter_${projectID}`),
        Markup.button.callback(t('kickstarters.single.admin.delete'), `deleteKickstarter_${projectID}`),
        Markup.button.callback(t('kickstarters.single.admin.buy'), `sendPayment`),
      ],
      [
        Markup.button.callback(t('kickstarters.single.admin.home'), `userMenu`),
      ]
    ]
  }


  if (projectData.photos.length > 0) {

    await ctx.telegram.sendPhoto(userId, projectData.photos[0], {
      caption: t('kickstarters.single.caption', {
        link: projectData.link,
        name: projectData.name,
        creator: projectData.creator,
        pledgeName: projectData.pledgeName,
        pledgeCost: projectData.pledgeCost,
        files: projectData.files.length,
        cost: projectData.cost
      }),
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });

  }
});