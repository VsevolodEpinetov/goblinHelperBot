const { Composer } = require("telegraf");

module.exports = Composer.action('noop', async (ctx) => {
  await ctx.answerCbQuery('Эта кнопка неактивна');
});
