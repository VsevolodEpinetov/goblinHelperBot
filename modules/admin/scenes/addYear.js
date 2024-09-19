const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')

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

  if (!ctx.months.list[year]) {
    ctx.months.list[year] = {};

    let menu = [];

    for (let year in ctx.months.list) {
      if (!ctx.months.list[year]) ctx.months.list[year] = {};
      menu.push(Markup.button.callback(year, `adminMonths_show_${year}`))
    }

    ctx.replyWithHTML(`✅ Добавил год <b>${year}</b>. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMenu`),
          Markup.button.callback('+', `monthsAddYear`),
        ]
      ])
    })
  } else {
    ctx.replyWithHTML(`⚠️ Год <b>${year}</b> уже существует. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMenu`),
          Markup.button.callback('+', `monthsAddYear`),
        ]
      ])
    })
  }

  ctx.scene.leave();

});

module.exports = adminSceneAddYear;
 