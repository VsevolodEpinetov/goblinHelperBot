const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('applicationQuestions', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const questionsMessage = "❓ <b>Вопросы новичка</b>\n\n⏳ <b>Срок рассмотрения:</b> обычно 1–3 дня, иногда до недели.\n💰 <b>Взнос:</b> 1000 ⭐ за обычный сундук, 2400 ⭐ за расширенный.\n📅 <b>Сокровища:</b> пополняются каждый цикл луны.\n🔒 <b>Делиться нельзя:</b> добыча только для личного пользования.\n💀 <b>Отказ:</b> будет уведомление, попробуешь позже.\n\nНужна помощь? Жми «Поддержка».";

  const questionsKeyboard = [
    [Markup.button.callback("📝 Подать заявку", 'startApplication')],
    [Markup.button.callback("📋 Правила", 'showRules')],
    [Markup.button.callback("❓ Что это", 'whatIsIt')],
    [Markup.button.callback("💬 Поддержка", 'contactSupport')],
    [
      Markup.button.callback("🔙 Назад", 'applyInit'),
      Markup.button.callback("🏠 В начало", 'whatIsIt')
    ]
  ];

  await ctx.editMessageText(questionsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(questionsKeyboard)
  });
});
