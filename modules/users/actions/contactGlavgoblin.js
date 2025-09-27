const { Composer } = require("telegraf");

module.exports = Composer.action('contact_glavgoblin', async (ctx) => {
  await ctx.answerCbQuery('Свяжитесь с @glavgoblin в личных сообщениях');
  
  await ctx.editMessageText(
'💀 <b>Ты ушёл из логова</b>\n\n' +
'Возврата нет — таков закон. Но своих мы не забываем.\n' +
'Если нужна связь — пиши Главгоблину: @glavgoblin\n\n' +
'🕊️ <i>Иди с миром</i>',
    { parse_mode: 'HTML' }
  );
});
