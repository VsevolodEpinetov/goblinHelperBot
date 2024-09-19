const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')

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

  if (!ctx.months.list[year]) ctx.months.list[year] = {};
  
  if (!ctx.months.list[year][month]) {
    ctx.months.list[year][month] = {
      regular: {
        link: '',
        id: '',
        counter: 0
      },
      plus: {
        link: '',
        id: '',
        counter: 0              
      }
    };

    let menu = [];

    for (const month in ctx.months.list[year]) {
      menu.push(Markup.button.callback(month, `adminMonths_show_${year}_${month}`))
    }

    ctx.replyWithHTML(`✅ Добавил месяц <b>${month}</b> в год <b>${year}</b>. Доступные месяцы в ${year}`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('+', `monthsAdd_${year}`),
        ]
      ])
    })
  } else {
    let menu = [];

    for (const month in ctx.months.list[year]) {
      menu.push(Markup.button.callback(month, `adminMonths_show_${year}_${month}`))
    }

    ctx.replyWithHTML(`⚠️ Месяц <b>${month}</b> уже существует в <b>${year}</b> уже существует. Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMonths`),
          Markup.button.callback('+', `monthsAdd_${year}`),
        ]
      ])
    })
  }

  ctx.scene.leave();

});

module.exports = adminSceneAddMonth;
 