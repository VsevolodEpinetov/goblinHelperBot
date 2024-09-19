const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')

const adminSceneAddLinkPlus = new Scenes.BaseScene('ADMIN_SCENE_ADD_LINK_PLUS');

adminSceneAddLinkPlus.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли ссылку для <b>плюсовой группы</b>`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

adminSceneAddLinkPlus.on('text', async (ctx) => {
  const year = ctx.session.year;
  const month = ctx.session.month;

  await ctx.deleteMessage(ctx.session.toRemove);

  ctx.months.list[year][month].plus.link = ctx.message.text;

  await ctx.replyWithHTML(`Данные за ${year}-${month}:\n\nСсылка на обычную группу: ${ctx.months.list[year][month].regular.link || 'not set'}\nПодтверждено участников: ${ctx.months.list[year][month].regular.counter}\n\nСсылка на плюсовую группу: ${ctx.message.text || 'not set'}\nПодтверждено участников: ${ctx.months.list[year][month].plus.counter}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('Ссылка на обычную', `adminAddLink_${year}_${month}`),
        Markup.button.callback('Ссылка на плюсовую', `adminAddLinkPlus_${year}_${month}`)
      ],
      [
        Markup.button.callback('←', `adminMonths_show_${year}`),
        Markup.button.callback('В начало', `adminMonths`),
      ]
    ])
  })

  ctx.scene.leave();

});

module.exports = adminSceneAddLinkPlus;
 