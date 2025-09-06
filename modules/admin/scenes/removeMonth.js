const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require("../../util");
const { getMonths } = require('../../db/helpers');

const adminSceneRemoveMonth = new Scenes.BaseScene('ADMIN_SCENE_REMOVE_MONTH');

adminSceneRemoveMonth.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли месяц, который я добавлю в год ${ctx.session.year}`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

adminSceneRemoveMonth.on('text', async (ctx) => {
  const year = ctx.session.year;
  const month = ctx.message.text;
  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  // Get months data from PostgreSQL
  const monthsData = await getMonths();
  
  if (monthsData.list[year] && monthsData.list[year][month]) {
    // Month exists, remove it from the data structure
    delete monthsData.list[year][month];

    let menu = [];

    for (const monthName in monthsData.list[year]) {
      menu.push(Markup.button.callback(monthName, `adminMonths_show_${year}_${monthName}`))
    }

    menu = util.splitMenu(menu);

    ctx.replyWithHTML(`✅ Убрал месяц <b>${month}</b> из года <b>${year}</b>. Доступные месяцы в ${year}`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        ...menu,
        [
          Markup.button.callback('←', `adminMonths`),
          Markup.button.callback('+', `monthsAdd_${year}`),
          Markup.button.callback('-', `monthsRemove_${year}`),
        ]
      ])
    })
  } else {
    // Month doesn't exist, show available months
    let menu = [];

    for (const monthName in monthsData.list[year]) {
      menu.push(Markup.button.callback(monthName, `adminMonths_show_${year}_${monthName}`))
    }

    ctx.replyWithHTML(`⚠️ Месяца <b>${month}</b> нет в <b>${year}</b>. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMonths`),
          Markup.button.callback('+', `monthsAdd_${year}`),
          Markup.button.callback('-', `monthsRemove_${year}`),
        ]
      ])
    })
  }

  ctx.scene.leave();

});

module.exports = adminSceneRemoveMonth;
 