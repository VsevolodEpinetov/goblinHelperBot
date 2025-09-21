const { Composer, Markup } = require("telegraf");
const util = require('../../util');

module.exports = Composer.action('applyInit', async (ctx) => {
  const applyMessage = "📝 <b>Обряд допуска</b>\n\nРаскройся перед советом: расскажи, кто ты и чего ищешь. Соблюдай закон логова и не лги.";

  const applyKeyboard = [
    [Markup.button.callback("📋 Читать законы", 'showRules')],
    [Markup.button.callback("📝 Начать обряд", 'startApplication')],
    [Markup.button.callback("❓ Вопросы по обряду", 'applicationQuestions')],
    [
      Markup.button.callback("🔙 Назад", 'whatIsIt'),
      Markup.button.callback("🏠 В начало", 'whatIsIt')
    ]
  ];

  await ctx.editMessageText(applyMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(applyKeyboard)
  });
});


