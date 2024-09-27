const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')

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

  if (ctx.months.list[year]) {
    let copy = ctx.months.list;
    delete copy[year];
    ctx.months.list = copy;

    let menu = [];

    for (let year in ctx.months.list) {
      if (!ctx.months.list[year]) ctx.months.list[year] = {};
      menu.push(Markup.button.callback(year, `adminMonths_show_${year}`))
    }

    ctx.replyWithHTML(`✅ Убрал год <b>${year}</b>. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMenu`),
          Markup.button.callback('+', `monthsAddYear`),
          Markup.button.callback('-', `monthsRemoveYear`),
        ]
      ])
    })
  } else {
    ctx.replyWithHTML(`⚠️ Года <b>${year}</b> не существует. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMenu`),
          Markup.button.callback('+', `monthsAddYear`),
          Markup.button.callback('-', `monthsRemoveYear`),
        ]
      ])
    })
  }

  ctx.scene.leave();

});

module.exports = adminSceneRemoveYear;
 