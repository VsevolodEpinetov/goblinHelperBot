const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { getMonths } = require('../../db/helpers');

const adminSceneRemoveYear = new Scenes.BaseScene('ADMIN_SCENE_REMOVE_YEAR');

adminSceneRemoveYear.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли год, который нужно убрать`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

adminSceneRemoveYear.on('text', async (ctx) => {
  const year = ctx.message.text;
  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  // Get months data from PostgreSQL
  const monthsData = await getMonths();
  
  if (monthsData.list[year]) {
    // Year exists, remove it from the data structure
    delete monthsData.list[year];

    let menu = [];

    for (let yearName in monthsData.list) {
      menu.push(Markup.button.callback(yearName, `adminMonths_show_${yearName}`))
    }

    ctx.replyWithHTML(`✅ Убрал год <b>${year}</b>. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `userMenu`),
          Markup.button.callback('+', `monthsAddYear`),
          Markup.button.callback('-', `monthsRemoveYear`),
        ]
      ])
    })
  } else {
    // Year doesn't exist, show available years
    let menu = [];

    for (let yearName in monthsData.list) {
      menu.push(Markup.button.callback(yearName, `adminMonths_show_${yearName}`))
    }

    ctx.replyWithHTML(`⚠️ Года <b>${year}</b> не существует. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `userMenu`),
          Markup.button.callback('+', `monthsAddYear`),
          Markup.button.callback('-', `monthsRemoveYear`),
        ]
      ])
    })
  }

  ctx.scene.leave();

});

module.exports = adminSceneRemoveYear;
 