const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^showKickstarterFromGoblin_/g, async (ctx) => {
  const projectID = ctx.callbackQuery.data.split('_')[1];
  const projectData = ctx.kickstarters.list[projectID];
  const userId = ctx.callbackQuery.from.id;
  const userData = ctx.users.list[userId];
  const scrolls = (Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.scrollsSpent) || 0;

  ctx.userSession.purchasing = {
    type: 'kickstarter',
    userId: userId,
    ksId: projectID,
    name: projectData.name,
    price: projectData.cost
  }

  let buttons = [
    Markup.button.callback(t('kickstarters.single.buy'), `sendPayment`)
  ];

  if (scrolls > 0 && projectData.cost < 500) {
    buttons = [
      [
        Markup.button.callback(t('kickstarters.single.buy'), `sendPayment`),
        Markup.button.callback(t('kickstarters.single.buyForScroll'), `getKickstarterForScroll_${userId}_${projectID}`)
      ]
    ]
  }

  if (util.isSuperUser(ctx.callbackQuery.from.id)) {
    buttons = [
      [
        Markup.button.callback(t('kickstarters.single.admin.edit'), `editKickstarter_${projectID}`),
        Markup.button.callback(t('kickstarters.single.admin.delete'), `deleteKickstarter_${projectID}`),
        Markup.button.callback(t('kickstarters.single.admin.buy'), `sendPayment`),
      ],
      [
        Markup.button.callback(t('kickstarters.single.admin.home'), `adminMenu`),
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