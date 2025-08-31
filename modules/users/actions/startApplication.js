const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('startApplication', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const applicationMessage = `📝 <b>ПОДАЧА ЗАЯВКИ</b>\n\n` +
    `🎯 <b>Перед подачей заявки убедитесь, что:</b>\n\n` +
    `✅ Вы прочитали правила сообщества\n` +
    `✅ Вы готовы соблюдать все условия\n` +
    `✅ У вас есть Telegram аккаунт\n` +
    `✅ Вы готовы к оплате участия\n\n` +
    `📋 <b>Что произойдет после подачи:</b>\n` +
    `1. Ваша заявка будет рассмотрена администрацией\n` +
    `2. Мы изучим ваш профиль и активность\n` +
    `3. Вы получите уведомление о решении\n` +
    `4. При одобрении вы получите инструкции по оплате\n\n` +
    `🚀 <b>Готовы подать заявку?</b>\n\n` +
    `Нажмите "Подать заявку" для продолжения.`;

  const applicationKeyboard = [
    [Markup.button.callback('📝 Подать заявку', 'applyYes')],
    [Markup.button.callback('📋 Читать правила', 'showRules')],
    [Markup.button.callback('❓ Вопросы', 'showWhatIs')],
    [
      Markup.button.callback('🔙 Назад', 'applyInit'),
      Markup.button.callback('🏠 В начало', 'guestStart')
    ]
  ];

  await ctx.editMessageText(applicationMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(applicationKeyboard)
  });
});
