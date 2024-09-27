const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^adminSelectCurrent_/g, async (ctx) => {
  const data = ctx.callbackQuery.data.split('_');
  if (!ctx.globalSession.current) {
    ctx.globalSession.current = {
      month: '',
      year: ''
    };
  }

  ctx.globalSession.current.year = data[1];
  ctx.globalSession.current.month = data[2];


  ctx.answerCbQuery(`Готово! Теперь ${data[1]}-${data[2]} текущий месяц`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.callbackQuery.from.id} changed an active month to ${data[1]}-${data[2]}`)
});