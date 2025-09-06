const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require("../../util");
const { getMonths, updateMonth } = require('../../db/helpers');

const adminSceneAddMonth = new Scenes.BaseScene('ADMIN_SCENE_ADD_MONTH');

adminSceneAddMonth.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли месяц, который я добавлю в год ${ctx.session.year}`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

adminSceneAddMonth.on('text', async (ctx) => {
  const year = ctx.session.year;
  const month = ctx.message.text;
  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  // Check if month already exists in PostgreSQL
  const monthsData = await getMonths();
  const monthExists = monthsData.list[year] && monthsData.list[year][month];

  if (!monthExists) {
    // Create month entries in PostgreSQL
    await updateMonth(`${year}_${month}`, 'regular', {
      link: '',
      id: '',
      counter: { paid: 0, joined: 0 }
    });
    await updateMonth(`${year}_${month}`, 'plus', {
      link: '',
      id: '',
      counter: { paid: 0, joined: 0 }
    });

    // Get updated months data for menu
    const updatedMonths = await getMonths();
    let menu = [];

    for (const monthName in updatedMonths.list[year]) {
      menu.push(Markup.button.callback(monthName, `adminMonths_show_${year}_${monthName}`))
    }

    menu = util.splitMenu(menu);

    ctx.replyWithHTML(`✅ Добавил месяц <b>${month}</b> в год <b>${year}</b>. Доступные месяцы в ${year}`, {
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
    // Get months data for menu
    const monthsData = await getMonths();
    let menu = [];

    for (const monthName in monthsData.list[year]) {
      menu.push(Markup.button.callback(monthName, `adminMonths_show_${year}_${monthName}`))
    }

    ctx.replyWithHTML(`⚠️ Месяц <b>${month}</b> уже существует в <b>${year}</b> уже существует. Доступные года`, {
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

module.exports = adminSceneAddMonth;
 