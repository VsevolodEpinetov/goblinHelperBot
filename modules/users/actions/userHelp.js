const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userHelp', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const helpMessage = `❓ <b>ПОМОЩЬ ПО БОТУ</b>\n\n` +
    `🎯 <b>Основные функции:</b>\n` +
    `• <b>Подписки</b> - управление месячными подписками\n` +
    `• <b>Кикстартеры</b> - доступ к проектам на Kickstarter\n` +
    `• <b>Баланс</b> - пополнение и траты\n` +
    `• <b>Билетики</b> - бонусные возможности\n\n` +
    `💡 <b>Советы:</b>\n` +
    `• Используйте кнопку "🔄 Обновить" для актуальной информации\n` +
    `• Красные кнопки - важные действия\n` +
    `• Зеленые кнопки - стандартные функции\n\n` +
    `📞 <b>Поддержка:</b>\n` +
    `Если у вас есть вопросы, обратитесь к администратору.`;

  const helpKeyboard = [
    [Markup.button.callback('📚 Подробная справка', 'detailedHelp')],
    [Markup.button.callback('🔙 Назад в меню', 'userMenu')]
  ];

  await ctx.editMessageText(helpMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(helpKeyboard)
  });
});
