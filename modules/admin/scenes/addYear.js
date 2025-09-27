const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { getMonths } = require('../../db/helpers');

const adminSceneAddYear = new Scenes.BaseScene('ADMIN_SCENE_ADD_YEAR');

adminSceneAddYear.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли год, который нужно создать`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

adminSceneAddYear.on('text', async (ctx) => {
  const year = ctx.message.text;
  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  // Get months data from PostgreSQL
  const monthsData = await getMonths();
  
  if (!monthsData.list[year]) {
    // Year doesn't exist yet, create empty structure
    monthsData.list[year] = {};

    let menu = [];

    for (let yearName in monthsData.list) {
      menu.push(Markup.button.callback(yearName, `adminMonths_show_${yearName}`))
    }

    ctx.replyWithHTML(`✅ Добавил год <b>${year}</b>. Доступные года`, {
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
    // Year already exists, show existing years
    let menu = [];

    for (let yearName in monthsData.list) {
      menu.push(Markup.button.callback(yearName, `adminMonths_show_${yearName}`))
    }

    ctx.replyWithHTML(`⚠️ Год <b>${year}</b> уже существует. Доступные года`, {
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

module.exports = adminSceneAddYear;
 