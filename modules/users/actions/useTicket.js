const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('useTicket', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;
  
  if (tickets <= 0) {
    await ctx.answerCbQuery('❌ У вас нет доступных билетиков!');
    return;
  }

  const ticketMessage = `🎟 <b>ИСПОЛЬЗОВАНИЕ БИЛЕТИКА</b>\n\n` +
    `🎫 <b>Доступно билетиков:</b> ${tickets}\n\n` +
    `🚀 <b>Что можно купить за билетик:</b>\n` +
    `• <b>Кикстартер проект</b> - любой доступный проект\n` +
    `• <b>Эксклюзивный контент</b> - специальные материалы\n` +
    `• <b>Ранний доступ</b> - приоритет к новым релизам\n` +
    `• <b>Специальные предложения</b> - уникальные возможности\n\n` +
    `💡 <b>Как получить больше билетиков:</b>\n` +
    `Покупайте ➕ подписки! За каждые 3 месяца ➕ вы получаете 2 билетика.`;

  const ticketKeyboard = [
    [
      Markup.button.callback('🚀 Кикстартеры', 'ticketKickstarters'),
      Markup.button.callback('⭐ Эксклюзив', 'ticketExclusive')
    ],
    [
      Markup.button.callback('🎁 Спецпредложения', 'ticketSpecial'),
      Markup.button.callback('📅 Ранний доступ', 'ticketEarlyAccess')
    ],
    [Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'userMenu')]
  ];

  await ctx.editMessageText(ticketMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(ticketKeyboard)
  });
});
