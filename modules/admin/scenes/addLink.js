const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { updateMonth, getMonths } = require('../../db/helpers');

const adminSceneAddLink = new Scenes.BaseScene('ADMIN_SCENE_ADD_LINK');

adminSceneAddLink.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли ссылку для <b>обычной группы</b>`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

adminSceneAddLink.on('text', async (ctx) => {
  const year = ctx.session.year;
  const month = ctx.session.month;

  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  // Update month data in PostgreSQL
  await updateMonth(`${year}_${month}`, 'regular', {
    link: ctx.message.text
  });

  // Get updated months data for display
  const monthsData = await getMonths();
  const monthData = monthsData.list[year][month];

  await ctx.replyWithHTML(`Данные за ${year}-${month}:\n\nСсылка на обычную группу: ${monthData.regular.link || 'not set'}\nПодтверждено участников: ${monthData.regular.counter}\n\nСсылка на плюсовую группу: ${monthData.plus.link || 'not set'}\nПодтверждено участников: ${monthData.plus.counter}`, {
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

module.exports = adminSceneAddLink;
 