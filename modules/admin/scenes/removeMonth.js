const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require("../../util");

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

  if (ctx.months.list[year][month]) {
    let copy = ctx.months.list[year];
    delete copy[month];
    ctx.months.list[year] = copy;

    let menu = [];

    for (const month in ctx.months.list[year]) {
      menu.push(Markup.button.callback(month, `adminMonths_show_${year}_${month}`))
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
    let menu = [];

    for (const month in ctx.months.list[year]) {
      menu.push(Markup.button.callback(month, `adminMonths_show_${year}_${month}`))
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
 