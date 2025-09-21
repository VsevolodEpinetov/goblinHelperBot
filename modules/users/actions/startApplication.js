const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('startApplication', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const applicationMessage = "📝 <b>Ритуал подачи</b>\n\nПрочти законы, будь готов платить и держи лицо перед советом. После обряда мы изучим твою тень и вынесем приговор.";

  const applicationKeyboard = [
    [Markup.button.callback("📝 Подать заявку", 'applyYes')],
    [Markup.button.callback("📋 Читать законы", 'showRules')],
    [Markup.button.callback("❓ Вопросы", 'whatIsIt')],
    [
      Markup.button.callback("🔙 Назад", 'applyInit'),
      Markup.button.callback("🏠 В начало", 'whatIsIt')
    ]
  ];

  await ctx.editMessageText(applicationMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(applicationKeyboard)
  });
});
